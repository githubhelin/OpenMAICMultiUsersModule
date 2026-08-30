import { verifyToken, signToken } from './crypto';
import type { AuthSessionPayload, SafeUser } from './types';
import { findUserById, toSafeUser } from './db';

export const SESSION_COOKIE_NAME = 'openmaic_session';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export function readCookieFromHeaders(headers: Headers, name: string): string | undefined {
  const encoded = headers.get('cookie');
  if (!encoded) return undefined;
  for (const item of encoded.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function buildSessionCookieHeader(token: string): string {
  const isSecure = process.env.COOKIE_SECURE === 'true';
  const secure = isSecure ? '; Secure' : '';
  return (
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; ` +
    `Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`
  );
}

export function buildClearSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function getSessionPayload(req: Pick<Request, 'headers'>): AuthSessionPayload | null {
  const token = readCookieFromHeaders(req.headers, SESSION_COOKIE_NAME);
  if (!token) return null;
  return verifyToken(token);
}

export async function getCurrentUser(req: Pick<Request, 'headers'>): Promise<SafeUser | null> {
  const payload = getSessionPayload(req);
  if (!payload || !payload.userId) return null;
  
  const user = await findUserById(payload.userId);
  if (!user || !user.is_active) return null;
  
  return toSafeUser(user);
}

export function createSessionToken(user: SafeUser): string {
  return signToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    nickname: user.nickname,
    avatar: user.avatar,
  });
}
