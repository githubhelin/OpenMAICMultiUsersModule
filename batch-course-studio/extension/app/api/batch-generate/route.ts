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
} from '@/lib/server/batch-generation/store';
import { runBatchJob } from '@/lib/server/batch-generation/runner';
import type { BatchJob, BatchJobMode, BatchSubTask } from '@/lib/server/batch-generation/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

const log = createLogger('BatchGenerateAPI');

export async function POST(req: NextRequest) {
  try {
    const session = getSessionPayload(req);
    const ownerId = session && session.userId ? `user:${session.userId}` : 'anon:default';

    await ensureBatchDirs();

    const formData = await req.formData();
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

    const jobId = `batch_${nanoid(10)}`;
    const now = new Date().toISOString();
    const baseUrl = buildRequestOrigin(req);

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

      tasks.push({
        id: taskId,
        fileName: safeName,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        tempFilePath,
        status: 'queued',
        progress: 0,
        stepMessage: '排队等待处理中...',
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
      title: defaultTitle,
      requirement,
      enableTTS,
      enableImageGeneration,
      totalTasks: tasks.length,
      completedTasks: 0,
      failedTasks: 0,
      progress: 0,
      createdAt: now,
      updatedAt: now,
      tasks,
    };

    await saveBatchJob(batchJob);
    log.info(`Created batch job ${jobId} with ${tasks.length} tasks [mode=${mode}] for owner ${ownerId}`);

    // 在后台异步启动执行流水线
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
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '服务器内部处理失败',
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = getSessionPayload(req);
    const ownerId = session && session.userId ? `user:${session.userId}` : 'anon:default';

    const jobs = await listBatchJobs(ownerId);
    return NextResponse.json({
      success: true,
      jobs: jobs.map((job) => ({
        id: job.id,
        title: job.title,
        mode: job.mode,
        status: job.status,
        totalTasks: job.totalTasks,
        completedTasks: job.completedTasks,
        failedTasks: job.failedTasks,
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
