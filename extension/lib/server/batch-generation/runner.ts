import { promises as fs } from 'fs';
import { createLogger } from '@/lib/logger';
import { generateClassroom } from '@/lib/server/classroom-generation';
import { getOwnerScopedDocumentStore } from '@/lib/server/agent-runtime/owner-scoped-documents';
import { extractFileContent } from './extractor';
import { getBatchJob, updateBatchJob, listBatchJobs } from './store';
import type { BatchJob, SubTaskStep } from './types';
import { buildCourseScaleInstruction } from '@/lib/types/course-scale';
import { syncInteractiveLibraryForStage } from '@/lib/server/interactive-library';
import { getStageAccessDb } from '@/lib/server/stage-access';
import { markStageGenerationComplete } from '@/lib/persistence/stage-meta';
import { getUserKV } from '@/lib/server/kv/user-kv';

const log = createLogger('BatchJobRunner');
const runningBatchJobs = new Map<string, Promise<void>>();
const jobAbortControllers = new Map<string, AbortController>();
let activeRunningJobId: string | null = null;
let isScheduling = false;
let lastKnownBaseUrl = 'http://localhost:3000';

async function safeUnlink(path?: string): Promise<void> {
  if (!path) return;
  try {
    await fs.unlink(path);
  } catch {
    // Ignore cleanup errors
  }
}

/** 更新所有排队等待中任务的序号及提示信息 */
async function updateQueuePositions(): Promise<void> {
  try {
    const allJobs = await listBatchJobs('');
    const queuedJobs = allJobs
      .filter((j) => j.status === 'queued')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (let idx = 0; idx < queuedJobs.length; idx++) {
      const qj = queuedJobs[idx];
      const position = idx + 1; // 1 表示紧接着执行
      if (qj.queuePosition !== position) {
        await updateBatchJob(qj.id, (job) => {
          job.queuePosition = position;
          for (const t of job.tasks) {
            if (t.status === 'queued') {
              t.stepMessage = `排队等待中 (前方有 ${position} 个批量任务正在执行/排队)...`;
            }
          }
        });
      }
    }
  } catch (err) {
    log.error('Failed to update queue positions:', err);
  }
}

/**
 * 串行调度器核心：检查是否有正在运行的任务，若空闲则按提交时间先后（FIFO）依次启动下一个排队任务
 */
export async function scheduleNextBatchJob(fallbackBaseUrl?: string): Promise<void> {
  if (fallbackBaseUrl) {
    lastKnownBaseUrl = fallbackBaseUrl;
  }
  const effectiveBaseUrl = fallbackBaseUrl || lastKnownBaseUrl || 'http://localhost:3000';

  if (isScheduling) return;
  isScheduling = true;

  try {
    // 1. 检查当前活跃任务是否仍在内存中运行
    if (activeRunningJobId) {
      if (runningBatchJobs.has(activeRunningJobId)) {
        // 当前有任务在跑，刷新排队状态后等待
        await updateQueuePositions();
        return;
      } else {
        activeRunningJobId = null;
      }
    }

    // 2. 检查全局任务列表
    const allJobs = await listBatchJobs('');

    // 处理因服务器重启导致的悬空 processing 任务
    for (const j of allJobs) {
      if (j.status === 'processing' && !runningBatchJobs.has(j.id)) {
        log.warn(`Found orphaned processing job ${j.id}, marking failed due to server restart`);
        await updateBatchJob(j.id, (job) => {
          job.status = 'failed';
          job.error = '服务重启导致任务中断，请重新提交';
          job.completedAt = new Date().toISOString();
        });
      }
    }

    // 3. 筛选所有 queued 状态的任务，按创建时间正序排列（先进先出 FIFO）
    const queuedJobs = allJobs
      .filter((j) => j.status === 'queued')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (queuedJobs.length === 0) {
      return;
    }

    // 取出队列头部的下一个任务执行
    const nextJob = queuedJobs[0];
    activeRunningJobId = nextJob.id;
    log.info(`Dequeuing next batch job: ${nextJob.id} (${nextJob.title})`);

    // 刷新剩余排队任务的序号
    for (let idx = 1; idx < queuedJobs.length; idx++) {
      const qj = queuedJobs[idx];
      await updateBatchJob(qj.id, (job) => {
        job.queuePosition = idx;
        for (const t of job.tasks) {
          if (t.status === 'queued') {
            t.stepMessage = `排队等待中 (前方有 ${idx} 个批量任务)...`;
          }
        }
      });
    }

    // 启动下一个任务的执行流水线
    const jobPromise = executeBatchJobInternal(nextJob.id, nextJob.baseUrl || effectiveBaseUrl);
    runningBatchJobs.set(nextJob.id, jobPromise);
  } catch (err) {
    log.error('Failed in scheduleNextBatchJob:', err);
  } finally {
    isScheduling = false;
  }
}

/** 取消/中断整个批量任务 */
export async function cancelBatchJob(jobId: string, ownerId?: string): Promise<boolean> {
  const job = await getBatchJob(jobId, ownerId);
  if (!job) return false;

  // 1. 触发正在运行中的 AbortController
  const controller = jobAbortControllers.get(jobId);
  if (controller) {
    controller.abort();
    jobAbortControllers.delete(jobId);
  }

  // 2. 将任务与所有未完成的子任务标记为 cancelled
  await updateBatchJob(jobId, (j) => {
    j.status = 'cancelled';
    j.queuePosition = undefined;
    j.completedAt = new Date().toISOString();
    for (const task of j.tasks) {
      if (task.status !== 'completed' && task.status !== 'failed') {
        task.status = 'cancelled';
        task.stepMessage = '任务已取消 (用户中断)';
        if (task.tempFilePath) {
          safeUnlink(task.tempFilePath);
        }
      }
    }
    j.cancelledTasks = j.tasks.filter((t) => t.status === 'cancelled').length;
  });

  // 如果取消的是当前运行的任务，清理占用状态
  if (activeRunningJobId === jobId) {
    activeRunningJobId = null;
    runningBatchJobs.delete(jobId);
  }

  // 触发调度下一个排队中的任务
  void scheduleNextBatchJob();

  log.info(`Batch job ${jobId} successfully cancelled by owner ${ownerId || 'system'}`);
  return true;
}

/** 取消/移除队列中的某个未完成子任务 */
export async function cancelBatchSubTask(
  jobId: string,
  taskId: string,
  ownerId?: string,
): Promise<boolean> {
  const job = await getBatchJob(jobId, ownerId);
  if (!job) return false;

  const targetTask = job.tasks.find((t) => t.id === taskId);
  if (!targetTask) return false;

  if (targetTask.status === 'completed') {
    return false;
  }

  // 如果该任务正在积极运行中，尝试终止当前正在执行的 LLM 生成
  if (targetTask.status !== 'queued') {
    const controller = jobAbortControllers.get(jobId);
    if (controller) {
      controller.abort();
    }
  }

  await updateBatchJob(jobId, (j) => {
    const t = j.tasks.find((task) => task.id === taskId);
    if (t) {
      t.status = 'cancelled';
      t.stepMessage = '已从队列中取消/移除';
      if (t.tempFilePath) {
        safeUnlink(t.tempFilePath);
      }
    }
    j.cancelledTasks = j.tasks.filter((task) => task.status === 'cancelled').length;
  });

  log.info(`SubTask ${taskId} in batch job ${jobId} cancelled`);
  return true;
}

/** 对外统一入口：加入批量制课调度队列并触发串行调度 */
export async function runBatchJob(jobId: string, baseUrl: string): Promise<void> {
  if (baseUrl) {
    lastKnownBaseUrl = baseUrl;
  }

  await updateBatchJob(jobId, (j) => {
    if (baseUrl) {
      j.baseUrl = baseUrl;
    }
  });

  // 触发队列串行调度
  await scheduleNextBatchJob(baseUrl);
}

/** 内部真正执行单个 BatchJob 的完整生命周期（执行完成后自动唤醒下一个队列任务） */
async function executeBatchJobInternal(jobId: string, baseUrl: string): Promise<void> {
  const controller = new AbortController();
  jobAbortControllers.set(jobId, controller);

  try {
    const initialJob = await getBatchJob(jobId);
    if (!initialJob) {
      log.error(`Batch job ${jobId} not found`);
      return;
    }

    if (initialJob.status === 'cancelled') {
      log.info(`Batch job ${jobId} was cancelled before starting`);
      return;
    }

    await updateBatchJob(jobId, (job) => {
      job.status = 'processing';
      job.queuePosition = undefined;
      job.startedAt = new Date().toISOString();
      job.progress = 5;
      for (const t of job.tasks) {
        if (t.status === 'queued') {
          t.stepMessage = '排队准备就绪，即将开始提取课件...';
        }
      }
    });

    // 自动继承用户服务端存储的设置 (MinerU / 阿里 / unpdf 等)
    let inheritedPdfProviderId = initialJob.pdfProviderId;
    let inheritedPdfProviderConfig = initialJob.pdfProviderConfig;

    if (!inheritedPdfProviderId && initialJob.ownerId?.startsWith('user:')) {
      try {
        const userId = initialJob.ownerId.replace('user:', '');
        const userSettings = await getUserKV<any>(userId, 'openmaic-settings');
        const pid = userSettings?.pdfProviderId;
        if (pid) {
          inheritedPdfProviderId = pid;
          inheritedPdfProviderConfig = userSettings.pdfProvidersConfig?.[pid];
          log.info(`Batch job ${jobId} automatically inherited PDF extractor from user ${userId}: ${pid}`);
        }
      } catch (err) {
        log.warn(`Failed to inspect user settings for job ${jobId}:`, err);
      }
    }

    if (inheritedPdfProviderId && (!initialJob.pdfProviderId || !initialJob.pdfProviderConfig)) {
      await updateBatchJob(jobId, (j) => {
        j.pdfProviderId = inheritedPdfProviderId;
        j.pdfProviderConfig = inheritedPdfProviderConfig;
      });
    }

    if (initialJob.mode === 'single_merged') {
      await executeSingleMergedJob(jobId, baseUrl, controller);
    } else {
      await executeBatchIndependentJob(jobId, baseUrl, controller);
    }
  } catch (error) {
    if (controller.signal.aborted || (error as any)?.name === 'AbortError') {
      log.info(`Batch job ${jobId} was aborted by user`);
      await updateBatchJob(jobId, (job) => {
        job.status = 'cancelled';
        job.queuePosition = undefined;
        job.completedAt = new Date().toISOString();
      });
      return;
    }
    log.error(`Batch job ${jobId} encountered unexpected error:`, error);
    const message = error instanceof Error ? error.message : String(error);
    await updateBatchJob(jobId, (job) => {
      job.status = 'failed';
      job.queuePosition = undefined;
      job.error = message;
      job.completedAt = new Date().toISOString();
    });
  } finally {
    jobAbortControllers.delete(jobId);
    runningBatchJobs.delete(jobId);
    if (activeRunningJobId === jobId) {
      activeRunningJobId = null;
    }
    // 任务执行结束（无论成功、失败或取消），自动启动队列中的下一个排队任务
    void scheduleNextBatchJob(baseUrl);
  }
}

/** 模式 A：多文件合为一门精品课程 */
async function executeSingleMergedJob(
  jobId: string,
  baseUrl: string,
  controller: AbortController,
): Promise<void> {
  const job = await getBatchJob(jobId);
  if (!job) return;

  log.info(`Executing single merged job ${jobId} with ${job.tasks.length} source files`);

  const extractedTexts: string[] = [];
  const extractedImages: string[] = [];

  // 1. 依次解析全部上传文件
  for (let i = 0; i < job.tasks.length; i++) {
    if (controller.signal.aborted) {
      const err = new Error('Batch job cancelled by user');
      err.name = 'AbortError';
      throw err;
    }

    const task = job.tasks[i];
    const progress = Math.round(5 + (i / job.tasks.length) * 20);

    const ext = task.fileName.toLowerCase().split('.').pop() || '';
    const defaultDocExtractor =
      job.pdfProviderId === 'mineru'
        ? 'MinerU 文档解析'
        : job.pdfProviderId === 'unpdf'
          ? 'unpdf 轻量解析器'
          : job.pdfProviderId === 'alidocmind'
            ? '阿里文档智能'
            : 'MinerU 文档解析';
    const guessedExtractor =
      task.extractorName ||
      (ext === 'pptx' ? 'PPTX 原生解析器' : ext === 'txt' || ext === 'md' ? '纯文本解析器' : defaultDocExtractor);

    await updateBatchJob(jobId, (j) => {
      j.progress = progress;
      const target = j.tasks.find((t) => t.id === task.id);
      if (target) {
        target.status = 'extracting';
        target.extractorName = guessedExtractor;
        target.progress = 50;
        target.stepMessage = `正在使用 ${guessedExtractor} 提取内容...`;
      }
    });

    try {
      if (task.tempFilePath) {
        const extracted = await extractFileContent(task.tempFilePath, task.fileName, task.mimeType, {
          providerId: job.pdfProviderId,
          config: job.pdfProviderConfig,
        });
        extractedTexts.push(`### 教学参考资料 [${i + 1}]: ${task.fileName}\n${extracted.text}`);
        extractedImages.push(...extracted.images);

        const activeExtractor = extracted.extractorName || guessedExtractor;

        await updateBatchJob(jobId, (j) => {
          const target = j.tasks.find((t) => t.id === task.id);
          if (target) {
            target.status = 'completed';
            target.extractorName = activeExtractor;
            target.progress = 100;
            target.stepMessage = `[${activeExtractor}] 提取完成 (${extracted.text.length} 字)`;
          }
        });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.warn(`Extraction error on ${task.fileName}:`, err);
      await updateBatchJob(jobId, (j) => {
        const target = j.tasks.find((t) => t.id === task.id);
        if (target) {
          target.status = 'failed';
          target.error = errMsg;
          target.stepMessage = `提取失败: ${errMsg}`;
        }
      });
    } finally {
      await safeUnlink(task.tempFilePath);
    }
  }

  if (controller.signal.aborted) {
    const err = new Error('Batch job cancelled by user');
    err.name = 'AbortError';
    throw err;
  }

  // 2. 检查是否有有效提取内容
  const combinedText = extractedTexts.join('\n\n---\n\n').trim();
  if (!combinedText) {
    throw new Error('未能从上传的任何文件中提取出有效文本或大纲内容');
  }

  // 3. 构建综合生成指令
  const scaleInstruction = buildCourseScaleInstruction(job.courseScale, job.enableInteractiveMode);
  const requirement = job.enableInteractiveMode
    ? `【课程教学主题】：${job.title || '多课件融合互动微课堂'}\n${job.requirement ? '【教学总要求】：\n' + job.requirement + '\n' : ''}【教学交互规范】：必须启用深度互动模式（Interactive-First），全课必须生成不少于3~4个生动的高品质可交互场景（涵盖物理/科学过程仿真、动态沙盒、算法可视化或趣味闯关游戏，提供完备的 widgetType 与 widgetOutline），与理论精讲及阶段小测深度交替融合。${scaleInstruction}`
    : `【课程教学主题】：${job.title || '多课件融合微课堂'}\n${job.requirement ? '【教学总要求】：\n' + job.requirement + '\n' : ''}${scaleInstruction}`;

  await updateBatchJob(jobId, (j) => {
    j.progress = 30;
  });

  // 4. 执行全自动课程生成管线
  const result = await generateClassroom(
    {
      requirement,
      pdfContent: {
        text: combinedText.slice(0, 30000),
        images: extractedImages.slice(0, 20),
      },
      enableTTS: job.enableTTS,
      enableImageGeneration: job.enableImageGeneration,
      interactiveMode: job.enableInteractiveMode,
      courseScale: job.courseScale,
      interactiveTheme: job.interactiveTheme,
      slideTheme: job.slideTheme,
    },
    {
      baseUrl,
      signal: controller.signal,
      onProgress: async (p) => {
        // Map 0-100% of generateClassroom to 30% - 95% of batch job
        const mappedProgress = Math.round(30 + p.progress * 0.65);
        await updateBatchJob(jobId, (j) => {
          j.progress = mappedProgress;
        });
      },
    },
  );

  // 5. 写入当前用户的专属 PostgreSQL 存储
  try {
    const store = await getOwnerScopedDocumentStore(job.ownerId);
    await store.saveDocument({
      stage: result.stage,
      scenes: result.scenes,
    });
    try {
      const db = await getStageAccessDb();
      await markStageGenerationComplete(db, result.id);
    } catch (completeErr) {
      log.warn(`Failed to mark generation complete for ${result.id}:`, completeErr);
    }
    log.info(`Merged course ${result.id} successfully saved to owner store (${job.ownerId})`);
  } catch (dbError) {
    log.warn(`Failed to sync merged course ${result.id} to owner store:`, dbError);
  }

  // 5.5 自动打包并导出互动内容至互动展厅
  void syncInteractiveLibraryForStage(result.stage, result.scenes).catch((err) => {
    log.warn(`Failed to sync interactive library for merged course ${result.id}:`, err);
  });

  // 6. 标记批次完成
  await updateBatchJob(jobId, (j) => {
    j.status = 'completed';
    j.progress = 100;
    j.completedTasks = j.tasks.length;
    j.resultClassroomId = result.id;
    j.resultClassroomUrl = result.url;
    j.resultStageId = result.stage.id;
    j.scenesCount = result.scenesCount;
    j.completedAt = new Date().toISOString();
  });

  log.info(`Single merged batch job ${jobId} completed successfully: ${result.url}`);
}

/** 模式 B：多文件分别独立生成课程 (一对一批量流水线) */
async function executeBatchIndependentJob(
  jobId: string,
  baseUrl: string,
  controller: AbortController,
): Promise<void> {
  const initialJob = await getBatchJob(jobId);
  if (!initialJob) return;

  const totalTasks = initialJob.tasks.length;
  log.info(`Executing batch independent job ${jobId} with ${totalTasks} sequential tasks`);

  let completedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < totalTasks; i++) {
    // 检查整体任务是否已被取消或中断
    const currentJob = await getBatchJob(jobId);
    if (!currentJob || currentJob.status === 'cancelled' || controller.signal.aborted) {
      log.info(`Batch job ${jobId} is cancelled, terminating independent queue immediately`);
      break;
    }

    const task = currentJob.tasks[i];
    const taskIndex = i;

    // 检查此特定子任务是否已被用户从队列中移除/取消
    if (task.status === 'cancelled') {
      log.info(`Task ${task.fileName} (${task.id}) was cancelled, skipping`);
      continue;
    }

    log.info(`[${i + 1}/${totalTasks}] Starting task: ${task.fileName}`);

    const ext = task.fileName.toLowerCase().split('.').pop() || '';
    const defaultDocExtractor =
      currentJob.pdfProviderId === 'mineru'
        ? 'MinerU 文档解析'
        : currentJob.pdfProviderId === 'unpdf'
          ? 'unpdf 轻量解析器'
          : currentJob.pdfProviderId === 'alidocmind'
            ? '阿里文档智能'
            : 'MinerU 文档解析';
    const guessedExtractor =
      task.extractorName ||
      (ext === 'pptx' ? 'PPTX 原生解析器' : ext === 'txt' || ext === 'md' ? '纯文本解析器' : defaultDocExtractor);

    await updateBatchJob(jobId, (j) => {
      const target = j.tasks[taskIndex];
      if (target) {
        target.status = 'extracting';
        target.extractorName = guessedExtractor;
        target.startedAt = new Date().toISOString();
        target.progress = 10;
        target.stepMessage = `正在使用 ${guessedExtractor} 提取课件与知识点...`;
      }
    });

    try {
      if (!task.tempFilePath) {
        throw new Error('课件临时存储路径丢失');
      }

      // 1. 提取当前文件内容
      const extracted = await extractFileContent(task.tempFilePath, task.fileName, task.mimeType, {
        providerId: currentJob.pdfProviderId,
        config: currentJob.pdfProviderConfig,
      });

      if (controller.signal.aborted) {
        const err = new Error('Batch job cancelled by user');
        err.name = 'AbortError';
        throw err;
      }

      const activeExtractor = extracted.extractorName || guessedExtractor;

      await updateBatchJob(jobId, (j) => {
        const target = j.tasks[taskIndex];
        if (target) {
          target.status = 'planning_outline';
          target.extractorName = activeExtractor;
          target.progress = 25;
          target.stepMessage = `[${activeExtractor}] 内容提取完成 (${extracted.slideCount ? extracted.slideCount + ' 页' : extracted.text.length + ' 字'})，正在规划课程大纲...`;
        }
      });

      // 2. 组装当前课程的个性化提示词
      const cleanFileName = task.fileName.replace(/\.[^/.]+$/, '');
      const hasSeriesMarker = /(第\s*\d+\s*[课讲章节]|[\(（]\s*[0-9一二三四五六七八九十上下]+\s*[\)）]|\bpart\s*\d+\b)/i.test(cleanFileName);
      const courseTitle =
        hasSeriesMarker && !/(第\s*\d+\s*[课讲章节]|[\(（]\s*[0-9一二三四五六七八九十上下]+\s*[\)）]|\bpart\s*\d+\b)/i.test(extracted.title || '')
          ? cleanFileName
          : extracted.title || cleanFileName;
      const scaleInstruction = buildCourseScaleInstruction(initialJob.courseScale, initialJob.enableInteractiveMode);
      const requirement = initialJob.enableInteractiveMode
        ? `【课程主题】：《${courseTitle}》\n${initialJob.requirement ? '【教学总要求】：\n' + initialJob.requirement + '\n' : ''}【教学交互规范】：必须启用深度互动模式（Interactive-First），全课必须生成不少于3~4个生动的高品质可交互场景（涵盖物理/科学过程仿真、动态沙盒、算法可视化或趣味闯关游戏，提供完备的 widgetType 与 widgetOutline），与理论精讲及阶段小测深度交替融合。${scaleInstruction}`
        : `【课程主题】：《${courseTitle}》\n${initialJob.requirement ? '【教学总要求】：\n' + initialJob.requirement + '\n' : ''}${scaleInstruction}`;

      // 3. 执行生成
      const result = await generateClassroom(
        {
          requirement,
          pdfContent: {
            text: extracted.text.slice(0, 25000),
            images: extracted.images.slice(0, 15),
          },
          enableTTS: initialJob.enableTTS,
          enableImageGeneration: initialJob.enableImageGeneration,
          interactiveMode: initialJob.enableInteractiveMode,
          courseScale: initialJob.courseScale,
          interactiveTheme: initialJob.interactiveTheme,
          slideTheme: initialJob.slideTheme,
        },
        {
          baseUrl,
          signal: controller.signal,
          onProgress: async (p) => {
            const stepMapping: Record<string, SubTaskStep> = {
              queued: 'planning_outline',
              generating_outlines: 'planning_outline',
              generating_scenes: 'building_scenes',
              generating_media: 'building_scenes',
              generating_tts: 'generating_tts',
              persisting: 'persisting',
              completed: 'completed',
              failed: 'failed',
            };
            const currentSubStep = stepMapping[p.step] || 'building_scenes';

            await updateBatchJob(jobId, (j) => {
              const target = j.tasks[taskIndex];
              if (target && target.status !== 'cancelled') {
                target.status = currentSubStep;
                target.progress = p.progress;
                target.stepMessage = p.message;
              }
              // Compute overall batch progress
              const currentTaskContribution = p.progress / 100;
              j.progress = Math.min(
                99,
                Math.round(((completedCount + currentTaskContribution) / totalTasks) * 100),
              );
            });
          },
        },
      );

      // 4. 同步至当前用户的 PostgreSQL 存储
      try {
        const store = await getOwnerScopedDocumentStore(initialJob.ownerId);
        await store.saveDocument({
          stage: result.stage,
          scenes: result.scenes,
        });
        try {
          const db = await getStageAccessDb();
          await markStageGenerationComplete(db, result.id);
        } catch (completeErr) {
          log.warn(`Failed to mark generation complete for ${result.id}:`, completeErr);
        }
        log.info(`Course ${result.id} successfully saved to owner store (${initialJob.ownerId})`);
      } catch (dbError) {
        log.warn(`Failed to sync course ${result.id} to owner store:`, dbError);
      }

      // 4.5 自动打包并导出互动内容至互动展厅
      void syncInteractiveLibraryForStage(result.stage, result.scenes).catch((err) => {
        log.warn(`Failed to sync interactive library for course ${result.id}:`, err);
      });

      // 5. 标记子任务成功
      completedCount++;
      await updateBatchJob(jobId, (j) => {
        j.completedTasks = completedCount;
        j.progress = Math.round((completedCount / totalTasks) * 100);
        const target = j.tasks[taskIndex];
        if (target) {
          target.status = 'completed';
          target.progress = 100;
          target.classroomId = result.id;
          target.classroomUrl = result.url;
          target.stageId = result.stage.id;
          target.scenesCount = result.scenesCount;
          target.stepMessage = `课程生成完成 (共 ${result.scenesCount} 页)`;
          target.completedAt = new Date().toISOString();
        }
      });

      log.info(`[${i + 1}/${totalTasks}] Finished: ${task.fileName} -> ${result.url}`);
    } catch (err) {
      if (controller.signal.aborted || (err as any)?.name === 'AbortError') {
        log.info(`[${i + 1}/${totalTasks}] Task ${task.fileName} aborted by user cancellation`);
        await updateBatchJob(jobId, (j) => {
          const target = j.tasks[taskIndex];
          if (target && target.status !== 'completed') {
            target.status = 'cancelled';
            target.stepMessage = '任务已取消 (用户中断)';
            target.completedAt = new Date().toISOString();
          }
          // Mark all remaining queued tasks as cancelled to stop token waste
          for (let k = taskIndex + 1; k < j.tasks.length; k++) {
            if (j.tasks[k].status === 'queued') {
              j.tasks[k].status = 'cancelled';
              j.tasks[k].stepMessage = '任务已取消 (用户中断)';
              safeUnlink(j.tasks[k].tempFilePath);
            }
          }
          j.cancelledTasks = j.tasks.filter((t) => t.status === 'cancelled').length;
          j.status = 'cancelled';
          j.completedAt = new Date().toISOString();
        });
        break;
      }

      failedCount++;
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error(`[${i + 1}/${totalTasks}] Failed: ${task.fileName}`, err);

      await updateBatchJob(jobId, (j) => {
        j.failedTasks = failedCount;
        const target = j.tasks[taskIndex];
        if (target) {
          target.status = 'failed';
          target.error = errMsg;
          target.stepMessage = `生成失败: ${errMsg}`;
          target.completedAt = new Date().toISOString();
        }
      });
    } finally {
      await safeUnlink(task.tempFilePath);
    }
  }

  // 6. 最终更新批次总体状态 (若非已取消)
  const finalJob = await getBatchJob(jobId);
  if (finalJob?.status === 'cancelled') {
    log.info(`Batch independent job ${jobId} finished in cancelled state`);
    return;
  }

  await updateBatchJob(jobId, (j) => {
    j.progress = 100;
    const cancelledCount = j.tasks.filter((t) => t.status === 'cancelled').length;
    j.cancelledTasks = cancelledCount;
    if (j.status !== 'cancelled') {
      if (failedCount === 0 && cancelledCount === 0) {
        j.status = 'completed';
      } else if (completedCount > 0) {
        j.status = 'partially_failed';
      } else {
        j.status = 'failed';
      }
    }
    j.completedAt = new Date().toISOString();
  });

  log.info(
    `Batch independent job ${jobId} finished: ${completedCount} succeeded, ${failedCount} failed`,
  );
}
