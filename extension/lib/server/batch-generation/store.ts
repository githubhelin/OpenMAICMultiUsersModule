import { promises as fs } from 'fs';
import path from 'path';
import type { BatchJob } from './types';
import { createLogger } from '@/lib/logger';

const log = createLogger('BatchJobStore');

export const BATCH_JOBS_DIR = path.join(process.cwd(), 'data', 'batch-jobs');
export const BATCH_TEMP_DIR = path.join(process.cwd(), 'data', 'batch-temp');

export async function ensureBatchDirs(): Promise<void> {
  await fs.mkdir(BATCH_JOBS_DIR, { recursive: true });
  await fs.mkdir(BATCH_TEMP_DIR, { recursive: true });
}

function jobFilePath(jobId: string): string {
  return path.join(BATCH_JOBS_DIR, `${jobId}.json`);
}

const jobMutex = new Map<string, Promise<void>>();

export async function saveBatchJob(job: BatchJob): Promise<void> {
  await ensureBatchDirs();
  const filePath = jobFilePath(job.id);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  job.updatedAt = new Date().toISOString();
  await fs.writeFile(tempPath, JSON.stringify(job, null, 2), 'utf-8');
  await fs.rename(tempPath, filePath);
}

export async function getBatchJob(jobId: string, ownerId?: string): Promise<BatchJob | null> {
  try {
    const filePath = jobFilePath(jobId);
    const content = await fs.readFile(filePath, 'utf-8');
    const job = JSON.parse(content) as BatchJob;
    if (ownerId && job.ownerId !== ownerId) {
      return null;
    }
    return job;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    log.error(`Failed to read batch job ${jobId}:`, error);
    return null;
  }
}

export async function updateBatchJob(
  jobId: string,
  updater: (job: BatchJob) => void,
): Promise<BatchJob | null> {
  const previous = jobMutex.get(jobId) ?? Promise.resolve();
  let result: BatchJob | null = null;

  const current = previous
    .catch(() => undefined)
    .then(async () => {
      const job = await getBatchJob(jobId);
      if (!job) return;
      updater(job);
      await saveBatchJob(job);
      result = job;
    });

  jobMutex.set(jobId, current);
  await current;
  return result;
}

export async function listBatchJobs(ownerId: string): Promise<BatchJob[]> {
  await ensureBatchDirs();
  try {
    const files = await fs.readdir(BATCH_JOBS_DIR);
    const jobs: BatchJob[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const filePath = path.join(BATCH_JOBS_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const job = JSON.parse(content) as BatchJob;
        if (!ownerId || job.ownerId === ownerId) {
          jobs.push(job);
        }
      } catch {
        // Skip corrupted or unreadable files
      }
    }

    return jobs.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } catch (error) {
    log.error('Failed to list batch jobs:', error);
    return [];
  }
}

export async function deleteBatchJob(jobId: string, ownerId?: string): Promise<boolean> {
  try {
    const job = await getBatchJob(jobId, ownerId);
    if (!job) return false;

    for (const task of job.tasks) {
      if (task.tempFilePath) {
        try {
          await fs.unlink(task.tempFilePath);
        } catch {
          // Ignore
        }
      }
    }

    const filePath = jobFilePath(jobId);
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    log.error(`Failed to delete batch job ${jobId}:`, error);
    return false;
  }
}

