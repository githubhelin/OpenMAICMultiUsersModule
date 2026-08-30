import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth/session';
import { updateUser, deleteUser, findUserById, toSafeUser } from '@/lib/server/auth/db';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const user = await findUserById(id);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: toSafeUser(user) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { nickname, avatar, bio, email, role, is_active, password } = body;

    // Prevent admin from accidentally demoting or disabling self
    if (id === currentUser.id) {
      if (role && role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Cannot demote your own admin account' }, { status: 400 });
      }
      if (is_active === false) {
        return NextResponse.json({ success: false, error: 'Cannot disable your own admin account' }, { status: 400 });
      }
    }

    const updated = await updateUser(id, {
      nickname,
      avatar,
      bio,
      email,
      role,
      is_active,
      password,
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'User not found or update failed' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    if (id === currentUser.id) {
      return NextResponse.json({ success: false, error: 'Cannot delete your own admin account' }, { status: 400 });
    }

    const deleted = await deleteUser(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'User not found or deletion failed' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
