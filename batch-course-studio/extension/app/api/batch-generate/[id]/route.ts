import { type NextRequest, NextResponse } from 'next/server';
import { getSessionPayload } from '@/lib/server/auth/session';
import { getBatchJob, deleteBatchJob } from '@/lib/server/batch-generation/store';
import { cancelBatchJob, cancelBatchSubTask } from '@/lib/server/batch-generation/runner';

export const runtime = 'nodejs';

/** 查询单个批量任务详情与实时进度 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = getSessionPayload(req);
    const ownerId = session && session.userId ? `user:${session.userId}` : undefined;

    const job = await getBatchJob(id, ownerId);

    if (!job) {
      return NextResponse.json(
        { success: false, error: '未找到该批处理任务' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取任务详情失败',
      },
      { status: 500 },
    );
  }
}

/** 取消任务操作：支持取消整个 Job 或取消队列中某个未生成的 SubTask */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = getSessionPayload(req);
    const ownerId = session && session.userId ? `user:${session.userId}` : undefined;

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'cancel';

    if (action === 'cancel') {
      // 中断整个任务，停止所有未完成子任务的执行与 Token 消耗
      const success = await cancelBatchJob(id, ownerId);
      if (!success) {
        return NextResponse.json(
          { success: false, error: '未找到该批处理任务或无权操作' },
          { status: 404 },
        );
      }
      return NextResponse.json({
        success: true,
        message: '批量制课任务已成功取消并中断',
      });
    }

    if (action === 'cancel_task') {
      const taskId = body.taskId;
      if (!taskId) {
        return NextResponse.json(
          { success: false, error: '缺少子任务 ID (taskId)' },
          { status: 400 },
        );
      }

      const success = await cancelBatchSubTask(id, taskId, ownerId);
      if (!success) {
        return NextResponse.json(
          { success: false, error: '未能取消该子任务（可能已完成或不存在）' },
          { status: 400 },
        );
      }
      return NextResponse.json({
        success: true,
        message: '子任务已成功从队列中移除并取消',
      });
    }

    return NextResponse.json(
      { success: false, error: `不支持的操作类型: ${action}` },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '取消操作执行失败',
      },
      { status: 500 },
    );
  }
}

/** 删除历史任务记录（若任务正在进行则先中断再删除） */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = getSessionPayload(req);
    const ownerId = session && session.userId ? `user:${session.userId}` : undefined;

    // 先中断正在执行的后台任务
    await cancelBatchJob(id, ownerId).catch(() => false);

    const deleted = await deleteBatchJob(id, ownerId);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: '未能删除任务（不存在或无权限）' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: '任务记录及临时文件已彻底清理删除',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除任务失败',
      },
      { status: 500 },
    );
  }
}
