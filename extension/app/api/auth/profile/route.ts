import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, createSessionToken, buildSessionCookieHeader } from '@/lib/server/auth/session';
import { findUserById, updateUser } from '@/lib/server/auth/db';
import { verifyPassword } from '@/lib/server/auth/crypto';

export const runtime = 'nodejs';

export async function PUT(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { nickname, avatar, bio, currentPassword, newPassword } = body;

    const updates: Parameters<typeof updateUser>[1] = {};

    if (nickname !== undefined) updates.nickname = nickname.trim();
    if (avatar !== undefined) updates.avatar = avatar.trim();
    if (bio !== undefined) updates.bio = bio ? bio.trim() : null;

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, error: 'Current password is required to set a new password' },
          { status: 400 }
        );
      }
      if (newPassword.length < 6) {
        return NextResponse.json(
          { success: false, error: 'New password must be at least 6 characters' },
          { status: 400 }
        );
      }

      const fullUser = await findUserById(currentUser.id);
      if (!fullUser) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
      }

      const valid = await verifyPassword(currentPassword, fullUser.password_hash, fullUser.salt);
      if (!valid) {
        return NextResponse.json(
          { success: false, error: 'Incorrect current password' },
          { status: 400 }
        );
      }

      updates.password = newPassword;
    }

    const updated = await updateUser(currentUser.id, updates);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
    }

    const token = createSessionToken(updated);
    const cookieHeader = buildSessionCookieHeader(token);

    const response = NextResponse.json({
      success: true,
      user: updated,
    });
    response.headers.set('Set-Cookie', cookieHeader);

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
