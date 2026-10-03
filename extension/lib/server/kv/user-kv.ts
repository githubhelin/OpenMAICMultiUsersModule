import { getPool, ensureUserSchema } from '@/lib/server/auth/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('UserKVStore');

export async function getUserKV<T = unknown>(userId: string, key: string): Promise<T | null> {
  await ensureUserSchema();
  const pool = getPool();
  try {
    const res = await pool.query(
      'SELECT value FROM user_kv_store WHERE user_id = $1 AND key = $2 LIMIT 1',
      [userId, key]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0].value as T;
  } catch (err) {
    log.error(`Failed to get user KV [${userId}:${key}]:`, err);
    throw err;
  }
}

export async function setUserKV(userId: string, key: string, value: unknown): Promise<void> {
  await ensureUserSchema();
  const pool = getPool();
  try {
    await pool.query(
      `INSERT INTO user_kv_store (user_id, key, value, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [userId, key, JSON.stringify(value)]
    );
  } catch (err) {
    log.error(`Failed to set user KV [${userId}:${key}]:`, err);
    throw err;
  }
}

export async function deleteUserKV(userId: string, key: string): Promise<void> {
  await ensureUserSchema();
  const pool = getPool();
  try {
    await pool.query(
      'DELETE FROM user_kv_store WHERE user_id = $1 AND key = $2',
      [userId, key]
    );
  } catch (err) {
    log.error(`Failed to delete user KV [${userId}:${key}]:`, err);
    throw err;
  }
}

export async function listUserKVKeys(userId: string, prefix = ''): Promise<string[]> {
  await ensureUserSchema();
  const pool = getPool();
  try {
    if (prefix) {
      const res = await pool.query(
        'SELECT key FROM user_kv_store WHERE user_id = $1 AND key LIKE $2 ORDER BY key',
        [userId, `${prefix}%`]
      );
      return res.rows.map((r) => r.key);
    }
    const res = await pool.query(
      'SELECT key FROM user_kv_store WHERE user_id = $1 ORDER BY key',
      [userId]
    );
    return res.rows.map((r) => r.key);
  } catch (err) {
    log.error(`Failed to list user KV keys [${userId}]:`, err);
    throw err;
  }
}
