import { promises as fs } from 'fs';
import { createLogger } from '@/lib/logger';
import { generateClassroom } from '@/lib/server/classroom-generation';
import { getOwnerScopedDocumentStore } from '@/lib/server/agent-runtime/owner-scoped-documents';
import { extractFileContent } from './extractor';
import { getBatchJob, updateBatchJob } from './store';
import type { BatchJob, SubTaskStep } from './types';

const log = createLogger('BatchJobRunner');
const runningBatchJobs = new Map<string, Promise<void>>();

async function safeUnlink(path?: string): Promise<void> {
  if (!path) return;
  try {
    await fs.unlink(path);
  } catch {
    // Ignore cleanup errors
  }
}

export function runBatchJob(jobId: string, baseUrl: string): Promise<void> {
  const existing = runningBatchJobs.get(jobId);
  if (existing) return existing;

  const jobPromise = (async () => {
    try {
      const initialJob = await getBatchJob(jobId);
      if (!initialJob) {
        log.error(`Batch job ${jobId} not found`);
        return;
      }

      await updateBatchJob(jobId, (job) => {
        job.status = 'processing';
        job.startedAt = new Date().toISOString();
        job.progress = 5;
      });

      if (initialJob.mode === 'single_merged') {
        await executeSingleMergedJob(jobId, baseUrl);
      } else {
        await executeBatchIndependentJob(jobId, baseUrl);
      }
    } catch (error) {
      log.error(`Batch job ${jobId} encountered unexpected error:`, error);
      const message = error instanceof Error ? error.message : String(error);
      await updateBatchJob(jobId, (job) => {
        job.status = 'failed';
        job.error = message;
        job.completedAt = new Date().toISOString();
      });
    } finally {
      runningBatchJobs.delete(jobId);
    }
  })();

  runningBatchJobs.set(jobId, jobPromise);
  return jobPromise;
}

/** 模式 A：多文件合为一门精品课程 */
async function executeSingleMergedJob(jobId: string, baseUrl: string): Promise<void> {
  const job = await getBatchJob(jobId);
  if (!job) return;

  log.info(`Executing single merged job ${jobId} with ${job.tasks.length} source files`);

  const extractedTexts: string[] = [];
  const extractedImages: string[] = [];

  // 1. 依次解析全部上传文件
  for (let i = 0; i < job.tasks.length; i++) {
    const task = job.tasks[i];
    const progress = Math.round(5 + (i / job.tasks.length) * 20);

    await updateBatchJob(jobId, (j) => {
      j.progress = progress;
      const target = j.tasks.find((t) => t.id === task.id);
      if (target) {
        target.status = 'extracting';
        target.progress = 50;
        target.stepMessage = `正在使用 MinerU / 课件解析器提取内容...`;
      }
    });

    try {
      if (task.tempFilePath) {
        const extracted = await extractFileContent(task.tempFilePath, task.fileName, task.mimeType);
        extractedTexts.push(`### 教学参考资料 [${i + 1}]: ${task.fileName}\n${extracted.text}`);
        extractedImages.push(...extracted.images);

        await updateBatchJob(jobId, (j) => {
          const target = j.tasks.find((t) => t.id === task.id);
          if (target) {
            target.status = 'completed';
            target.progress = 100;
            target.stepMessage = `提取完成 (${extracted.text.length} 字)`;
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

  // 2. 检查是否有有效提取内容
  const combinedText = extractedTexts.join('\n\n---\n\n').trim();
  if (!combinedText) {
    throw new Error('未能从上传的任何文件中提取出有效文本或大纲内容');
  }

  // 3. 构建综合生成指令
  const requirement = `${job.requirement ? job.requirement + '\n\n' : ''}【教学素材与知识点内容】：\n${combinedText.slice(0, 30000)}`;

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
    },
    {
      baseUrl,
      onProgress: async (p) => {
        // Map 0-100% of generateClassroom to 30% - 95% of batch job
        const mappedProgress = Math.round(30 + (p.progress * 0.65));
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
    log.info(`Merged course ${result.id} successfully saved to owner store (${job.ownerId})`);
  } catch (dbError) {
    log.warn(`Failed to sync merged course ${result.id} to owner store:`, dbError);
  }

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
async function executeBatchIndependentJob(jobId: string, baseUrl: string): Promise<void> {
  const job = await getBatchJob(jobId);
  if (!job) return;

  const totalTasks = job.tasks.length;
  log.info(`Executing batch independent job ${jobId} with ${totalTasks} sequential tasks`);

  let completedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < totalTasks; i++) {
    const task = job.tasks[i];
    const taskIndex = i;

    log.info(`[${i + 1}/${totalTasks}] Starting task: ${task.fileName}`);

    await updateBatchJob(jobId, (j) => {
      const target = j.tasks[taskIndex];
      if (target) {
        target.status = 'extracting';
        target.startedAt = new Date().toISOString();
        target.progress = 10;
        target.stepMessage = '正在提取课件与知识点...';
      }
    });

    try {
      if (!task.tempFilePath) {
        throw new Error('课件临时存储路径丢失');
      }

      // 1. 提取当前文件内容
      const extracted = await extractFileContent(task.tempFilePath, task.fileName, task.mimeType);

      await updateBatchJob(jobId, (j) => {
        const target = j.tasks[taskIndex];
        if (target) {
          target.status = 'planning_outline';
          target.progress = 25;
          target.stepMessage = '正在规划课程大纲与交互流程...';
        }
      });

      // 2. 组装当前课程的个性化提示词
      const courseTitle = extracted.title || task.fileName.replace(/\.[^/.]+$/, '');
      const requirement = `【课程主题】：《${courseTitle}》\n${job.requirement ? '【教学总要求】：' + job.requirement + '\n' : ''}【课件核心内容】：\n${extracted.text.slice(0, 25000)}`;

      // 3. 执行生成
      const result = await generateClassroom(
        {
          requirement,
          pdfContent: {
            text: extracted.text.slice(0, 25000),
            images: extracted.images.slice(0, 15),
          },
          enableTTS: job.enableTTS,
          enableImageGeneration: job.enableImageGeneration,
        },
        {
          baseUrl,
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
              if (target) {
                target.status = currentSubStep;
                target.progress = p.progress;
                target.stepMessage = p.message;
              }
              // Compute overall batch progress
              const currentTaskContribution = (p.progress / 100);
              j.progress = Math.min(99, Math.round(((completedCount + currentTaskContribution) / totalTasks) * 100));
            });
          },
        },
      );

      // 4. 同步至当前用户的 PostgreSQL 存储
      try {
        const store = await getOwnerScopedDocumentStore(job.ownerId);
        await store.saveDocument({
          stage: result.stage,
          scenes: result.scenes,
        });
        log.info(`Course ${result.id} successfully saved to owner store (${job.ownerId})`);
      } catch (dbError) {
        log.warn(`Failed to sync course ${result.id} to owner store:`, dbError);
      }

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

  // 6. 最终更新批次总体状态
  await updateBatchJob(jobId, (j) => {
    j.progress = 100;
    j.status = failedCount === 0 ? 'completed' : completedCount > 0 ? 'partially_failed' : 'failed';
    j.completedAt = new Date().toISOString();
  });

  log.info(`Batch independent job ${jobId} finished: ${completedCount} succeeded, ${failedCount} failed`);
}
