import { type NextRequest, NextResponse } from 'next/server';
import { findUserByUsername, toSafeUser } from '@/lib/server/auth/db';
import { verifyPassword } from '@/lib/server/auth/crypto';
import { createSessionToken, buildSessionCookieHeader } from '@/lib/server/auth/session';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const user = await findUserByUsername(username);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { success: false, error: 'This account has been disabled by administrator' },
        { status: 403 }
      );
    }

    const valid = await verifyPassword(password, user.password_hash, user.salt);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const safeUser = toSafeUser(user);
    const token = createSessionToken(safeUser);
    const cookieHeader = buildSessionCookieHeader(token);

    const response = NextResponse.json({
      success: true,
      user: safeUser,
    });
    response.headers.set('Set-Cookie', cookieHeader);

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
