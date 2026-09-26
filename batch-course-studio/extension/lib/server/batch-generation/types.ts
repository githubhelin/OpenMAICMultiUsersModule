import type { CourseScale } from '@/lib/types/course-scale';

export type BatchJobMode = 'single_merged' | 'batch_independent';

export type BatchJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'partially_failed'
  | 'cancelled';

export type SubTaskStep =
  | 'queued'
  | 'extracting'
  | 'planning_outline'
  | 'building_scenes'
  | 'generating_tts'
  | 'persisting'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface BatchSubTask {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  tempFilePath?: string;
  status: SubTaskStep;
  progress: number; // 0 - 100
  stepMessage: string;
  classroomId?: string;
  classroomUrl?: string;
  stageId?: string;
  scenesCount?: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface BatchJob {
  id: string;
  ownerId: string;
  mode: BatchJobMode;
  status: BatchJobStatus;
  title: string;
  requirement: string;
  enableTTS: boolean;
  enableImageGeneration: boolean;
  enableInteractiveMode?: boolean;
  courseScale?: CourseScale;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  cancelledTasks?: number;
  progress: number; // 0 - 100
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  tasks: BatchSubTask[];
  // If mode === 'single_merged':
  resultClassroomId?: string;
  resultClassroomUrl?: string;
  resultStageId?: string;
  scenesCount?: number;
  error?: string;
}
