import { type NextRequest, NextResponse } from 'next/server';
import { getSessionPayload } from '@/lib/server/auth/session';
import { listUserKVKeys } from '@/lib/server/kv/user-kv';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionPayload(req);
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } },
        { status: 401 }
      );
    }
    const url = new URL(req.url);
    const prefix = url.searchParams.get('prefix') || '';
    const keys = await listUserKVKeys(session.userId, prefix);
    return NextResponse.json(keys);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
