import { NextResponse } from 'next/server';
import { buildClearSessionCookieHeader } from '@/lib/server/auth/session';

export const runtime = 'nodejs';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  response.headers.set('Set-Cookie', buildClearSessionCookieHeader());
  return response;
}
