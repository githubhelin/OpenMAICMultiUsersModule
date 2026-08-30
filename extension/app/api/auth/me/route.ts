import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth/session';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, user: null, error: message }, { status: 500 });
  }
}
