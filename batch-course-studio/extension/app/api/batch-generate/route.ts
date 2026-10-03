import { after, type NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { getSessionPayload } from '@/lib/server/auth/session';
import { buildRequestOrigin } from '@/lib/server/classroom-storage';
import { createLogger } from '@/lib/logger';
import {
  BATCH_TEMP_DIR,
  ensureBatchDirs,
  listBatchJobs,
  saveBatchJob,
  getBatchJob,
  updateBatchJob,
} from '@/lib/server/batch-generation/store';
import { runBatchJob, scheduleNextBatchJob } from '@/lib/server/batch-generation/runner';
import type { BatchJob, BatchJobMode, BatchSubTask } from '@/lib/server/batch-generation/types';
import type { CourseScale } from '@/lib/types/course-scale';
import type { InteractiveThemeStyle, SlideThemeStyle } from '@/lib/types/theme-style';

export const runtime = 'nodejs';
export const maxDuration = 300;

const log = createLogger('BatchGenerateAPI');

export async function POST(req: NextRequest) {
  try {
    const session = getSessionPayload(req);
    const ownerId = session && session.userId ? `user:${session.userId}` : 'anon:default';

    await ensureBatchDirs();

    const formData = await req.formData();
    const action = (formData.get('action') as string) || '';

    // 分支 1：初始化分步批量上传草稿 (create_draft)
    if (action === 'create_draft') {
      const rawMode = formData.get('mode') as string;
      const mode: BatchJobMode = rawMode === 'single_merged' ? 'single_merged' : 'batch_independent';
      const requirement = (formData.get('prompt') as string) || '';
      const enableTTS = formData.get('enableTTS') !== 'false';
      const enableImageGeneration = formData.get('enableImageGeneration') !== 'false';
      const enableInteractiveMode =
        formData.get('enableInteractiveMode') === 'true' ||
        formData.get('interactiveMode') === 'true';
      const rawCourseScale = formData.get('courseScale') as string;
      const courseScale: CourseScale =
        rawCourseScale === 'micro' || rawCourseScale === 'thematic' ? rawCourseScale : 'standard';
      const rawInteractiveTheme = formData.get('interactiveTheme') as string;
      const interactiveTheme: InteractiveThemeStyle =
        rawInteractiveTheme === 'light' ? 'light' : 'dark';
      const rawSlideTheme = formData.get('slideTheme') as string;
      const slideTheme: SlideThemeStyle =
        rawSlideTheme === 'dark' ? 'dark' : 'light';
      const expectedTotal = parseInt((formData.get('totalTasks') as string) || '0', 10);
      const pdfProviderId = (formData.get('pdfProviderId') as string) || undefined;
      const rawPdfProviderConfig = formData.get('pdfProviderConfig') as string;
      let pdfProviderConfig: BatchJob['pdfProviderConfig'] = undefined;
      if (rawPdfProviderConfig) {
        try {
          pdfProviderConfig = JSON.parse(rawPdfProviderConfig);
        } catch {
          // Ignore parse errors
        }
      }

      const jobId = `batch_${nanoid(10)}`;
      const now = new Date().toISOString();
      const baseUrl = buildRequestOrigin(req);

      const defaultTitle =
        mode === 'single_merged'
          ? `多资料合成课件 (${expectedTotal || 0} 个资料)`
          : `批量课程生成 (${expectedTotal || 0} 门课)`;

      const batchJob: BatchJob = {
        id: jobId,
        ownerId,
        mode,
        status: 'uploading',
        baseUrl,
        title: defaultTitle,
        requirement,
        enableTTS,
        enableImageGeneration,
        enableInteractiveMode,
        courseScale,
        interactiveTheme,
        slideTheme,
        pdfProviderId,
        pdfProviderConfig,
        totalTasks: expectedTotal,
        completedTasks: 0,
        failedTasks: 0,
        cancelledTasks: 0,
        progress: 0,
        createdAt: now,
        updatedAt: now,
        tasks: [],
      };

      await saveBatchJob(batchJob);
      log.info(`Initialized draft batch job ${jobId} (expecting ${expectedTotal} tasks) for ${ownerId}`);
      return NextResponse.json({ success: true, batchId: jobId });
    }

    // 分支 2：单文件逐个上传并更新数量计数 (upload_task)
    if (action === 'upload_task') {
      const batchId = formData.get('batchId') as string;
      const file = formData.get('file') as File | null;

      if (!batchId || !file) {
        return NextResponse.json(
          { success: false, error: '缺少 batchId 或上传文件' },
          { status: 400 },
        );
      }

      const job = await getBatchJob(batchId, ownerId);
      if (!job) {
        return NextResponse.json(
          { success: false, error: '未找到对应的批量制课草稿任务' },
          { status: 404 },
        );
      }

      const taskId = `task_${nanoid(8)}`;
      const safeName = file.name || `file_${job.tasks.length + 1}.pptx`;
      const tempFileName = `${batchId}_${taskId}_${safeName}`;
      const tempFilePath = path.join(BATCH_TEMP_DIR, tempFileName);

      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(tempFilePath, buffer);

      const ext = safeName.toLowerCase().split('.').pop() || '';
      const docLabel =
        job.pdfProviderId === 'mineru'
          ? 'MinerU 文档解析'
          : job.pdfProviderId === 'unpdf'
            ? 'unpdf 轻量解析器'
            : job.pdfProviderId === 'alidocmind'
              ? '阿里文档智能'
              : 'MinerU 文档解析';
      const guessedExtractor =
        ext === 'pptx'
          ? 'PPTX 原生解析器'
          : ext === 'txt' || ext === 'md'
            ? '纯文本解析器'
            : docLabel;

      const task: BatchSubTask = {
        id: taskId,
        fileName: safeName,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        tempFilePath,
        status: 'queued',
        progress: 0,
        stepMessage: '等待调度中...',
        extractorName: guessedExtractor,
      };

      await updateBatchJob(batchId, (j) => {
        j.tasks.push(task);
        j.totalTasks = j.tasks.length;
        if (j.mode === 'single_merged') {
          j.title = `多资料合成课件 (${j.tasks.length} 个资料)`;
        } else {
          j.title = `批量课程生成 (${j.tasks.length} 门课)`;
        }
      });

      return NextResponse.json({
        success: true,
        taskId,
        uploadedCount: job.tasks.length + 1,
      });
    }

    // 分支 3：上传就绪，正式加入执行队列 (start_job)
    if (action === 'start_job') {
      const batchId = formData.get('batchId') as string;
      if (!batchId) {
        return NextResponse.json(
          { success: false, error: '缺少 batchId' },
          { status: 400 },
        );
      }

      const job = await getBatchJob(batchId, ownerId);
      if (!job || job.tasks.length === 0) {
        return NextResponse.json(
          { success: false, error: '任务不存在或未包含任何有效课件' },
          { status: 400 },
        );
      }

      const baseUrl = job.baseUrl || buildRequestOrigin(req);

      await updateBatchJob(batchId, (j) => {
        j.status = 'queued';
        for (const t of j.tasks) {
          t.stepMessage = '排队等待处理中...';
        }
      });

      after(() => runBatchJob(batchId, baseUrl));

      return NextResponse.json({
        success: true,
        batchId,
        status: 'queued',
        totalTasks: job.tasks.length,
      });
    }

    // 分支 4：常规单次全量上传 (原模式向后兼容)
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: '请至少上传一个课件文件 (.pptx, .pdf, .docx, .txt)' },
        { status: 400 },
      );
    }

    const rawMode = formData.get('mode') as string;
    const mode: BatchJobMode = rawMode === 'single_merged' ? 'single_merged' : 'batch_independent';
    const requirement = (formData.get('prompt') as string) || '';
    const enableTTS = formData.get('enableTTS') !== 'false';
    const enableImageGeneration = formData.get('enableImageGeneration') !== 'false';
    const enableInteractiveMode =
      formData.get('enableInteractiveMode') === 'true' ||
      formData.get('interactiveMode') === 'true';
    const rawCourseScale = formData.get('courseScale') as string;
    const courseScale: CourseScale =
      rawCourseScale === 'micro' || rawCourseScale === 'thematic' ? rawCourseScale : 'standard';
    const rawInteractiveTheme = formData.get('interactiveTheme') as string;
    const interactiveTheme: InteractiveThemeStyle =
      rawInteractiveTheme === 'light' ? 'light' : 'dark';
    const rawSlideTheme = formData.get('slideTheme') as string;
    const slideTheme: SlideThemeStyle =
      rawSlideTheme === 'dark' ? 'dark' : 'light';
    const pdfProviderId = (formData.get('pdfProviderId') as string) || undefined;
    const rawPdfProviderConfig = formData.get('pdfProviderConfig') as string;
    let pdfProviderConfig: BatchJob['pdfProviderConfig'] = undefined;
    if (rawPdfProviderConfig) {
      try {
        pdfProviderConfig = JSON.parse(rawPdfProviderConfig);
      } catch {
        // Ignore parse errors
      }
    }

    const jobId = `batch_${nanoid(10)}`;
    const now = new Date().toISOString();
    const baseUrl = buildRequestOrigin(req);

    const docLabel =
      pdfProviderId === 'mineru'
        ? 'MinerU 文档解析'
        : pdfProviderId === 'unpdf'
          ? 'unpdf 轻量解析器'
          : pdfProviderId === 'alidocmind'
            ? '阿里文档智能'
            : 'MinerU 文档解析';

    const tasks: BatchSubTask[] = [];

    // 保存上传的各个文件到临时目录
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const taskId = `task_${nanoid(8)}`;
      const safeName = file.name || `file_${i + 1}.pptx`;
      const tempFileName = `${jobId}_${taskId}_${safeName}`;
      const tempFilePath = path.join(BATCH_TEMP_DIR, tempFileName);

      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(tempFilePath, buffer);

      const ext = safeName.toLowerCase().split('.').pop() || '';
      const guessedExtractor =
        ext === 'pptx'
          ? 'PPTX 原生解析器'
          : ext === 'txt' || ext === 'md'
            ? '纯文本解析器'
            : docLabel;

      tasks.push({
        id: taskId,
        fileName: safeName,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        tempFilePath,
        status: 'queued',
        progress: 0,
        stepMessage: '排队等待处理中...',
        extractorName: guessedExtractor,
      });
    }

    const defaultTitle =
      mode === 'single_merged'
        ? `多资料合成课件 (${files.length} 个资料)`
        : `批量课程生成 (${files.length} 门课)`;

    const batchJob: BatchJob = {
      id: jobId,
      ownerId,
      mode,
      status: 'queued',
      baseUrl,
      title: defaultTitle,
      requirement,
      enableTTS,
      enableImageGeneration,
      enableInteractiveMode,
      courseScale,
      interactiveTheme,
      slideTheme,
      pdfProviderId,
      pdfProviderConfig,
      totalTasks: tasks.length,
      completedTasks: 0,
      failedTasks: 0,
      cancelledTasks: 0,
      progress: 0,
      createdAt: now,
      updatedAt: now,
      tasks,
    };

    await saveBatchJob(batchJob);
    log.info(`Created batch job ${jobId} with ${tasks.length} tasks [mode=${mode}] for owner ${ownerId}`);

    // 在后台异步启动执行流水线（若队列繁忙则进入排队）
    after(() => runBatchJob(jobId, baseUrl));

    return NextResponse.json(
      {
        success: true,
        batchId: jobId,
        status: 'queued',
        totalTasks: tasks.length,
        mode,
      },
      { status: 202 },
    );
  } catch (error) {
    log.error('Batch generation initiation failed:', error);
    let message = error instanceof Error ? error.message : '服务器内部处理失败';
    if (message.includes('Failed to parse body as FormData')) {
      message = '上传课件数据流解析失败（可能因网络中断或数据流超限切断）。请尝试检查网络或分批提交。';
    }
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = getSessionPayload(req);
    const ownerId = session && session.userId ? `user:${session.userId}` : 'anon:default';

    // 访问列表时触发调度检查，确保服务重启后若有排队任务可自动恢复推进
    void scheduleNextBatchJob();

    const jobs = await listBatchJobs(ownerId);
    return NextResponse.json({
      success: true,
      jobs: jobs.map((job) => ({
        id: job.id,
        title: job.title,
        mode: job.mode,
        status: job.status,
        queuePosition: job.queuePosition,
        totalTasks: job.totalTasks,
        completedTasks: job.completedTasks,
        failedTasks: job.failedTasks,
        cancelledTasks: job.cancelledTasks || 0,
        progress: job.progress,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        resultClassroomUrl: job.resultClassroomUrl,
      })),
    });
  } catch (error) {
    log.error('Failed to list batch jobs:', error);
    return NextResponse.json(
      { success: false, error: '获取批量任务列表失败' },
      { status: 500 },
    );
  }
}
