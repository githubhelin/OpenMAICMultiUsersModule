import { type NextRequest, NextResponse } from 'next/server';
import { getSessionPayload } from '@/lib/server/auth/session';
import { getUserKV, setUserKV, deleteUserKV } from '@/lib/server/kv/user-kv';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const session = getSessionPayload(req);
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } },
        { status: 401 }
      );
    }
    const { key } = await params;
    const decodedKey = decodeURIComponent(key);
    const value = await getUserKV(session.userId, decodedKey);
    if (value === null) {
      return NextResponse.json(
        { error: { code: 'KEY_NOT_FOUND', message: `Key "${decodedKey}" not found` } },
        { status: 404 }
      );
    }
    return NextResponse.json({ value });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const session = getSessionPayload(req);
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } },
        { status: 401 }
      );
    }
    const { key } = await params;
    const decodedKey = decodeURIComponent(key);
    const body = await req.json();
    if (body === undefined || !('value' in body)) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Request body must contain "value"' } },
        { status: 400 }
      );
    }
    await setUserKV(session.userId, decodedKey, body.value);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const session = getSessionPayload(req);
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } },
        { status: 401 }
      );
    }
    const { key } = await params;
    const decodedKey = decodeURIComponent(key);
    await deleteUserKV(session.userId, decodedKey);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
