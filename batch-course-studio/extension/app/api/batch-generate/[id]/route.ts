import { type NextRequest, NextResponse } from 'next/server';
import { getSessionPayload } from '@/lib/server/auth/session';
import { getBatchJob } from '@/lib/server/batch-generation/store';

export const runtime = 'nodejs';

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
