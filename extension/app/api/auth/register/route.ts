import { type NextRequest, NextResponse } from 'next/server';
import { createUser } from '@/lib/server/auth/db';
import { createSessionToken, buildSessionCookieHeader } from '@/lib/server/auth/session';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const allowRegistration = process.env.ALLOW_REGISTRATION !== 'false';
    if (!allowRegistration) {
      return NextResponse.json(
        { success: false, error: 'Registration is currently disabled by administrator' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { username, password, email, nickname, avatar } = body;

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Username must be at least 3 characters' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Basic format check
    if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
      return NextResponse.json(
        { success: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' },
        { status: 400 }
      );
    }

    const safeUser = await createUser({
      username: username.trim(),
      password,
      email: email?.trim() || null,
      nickname: nickname?.trim() || username.trim(),
      avatar: avatar || '/avatars/user.png',
      role: 'user',
    });

    const token = createSessionToken(safeUser);
    const cookieHeader = buildSessionCookieHeader(token);

    const response = NextResponse.json(
      { success: true, user: safeUser },
      { status: 201 }
    );
    response.headers.set('Set-Cookie', cookieHeader);

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
