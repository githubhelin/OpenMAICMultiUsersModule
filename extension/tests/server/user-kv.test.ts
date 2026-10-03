import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getUserKV, setUserKV, deleteUserKV, listUserKVKeys } from '@/lib/server/kv/user-kv';
import { ensureUserSchema, getPool } from '@/lib/server/auth/db';

describe('User Server-side KV Store', () => {
  const testUserId = 'test_user_kv_sync';
  const testKey = 'openmaic-settings';

  beforeAll(async () => {
    await ensureUserSchema();
    const pool = getPool();
    // Ensure test user exists to satisfy foreign key constraint
    await pool.query(
      `INSERT INTO users (id, username, password_hash, salt, nickname, role, is_active)
       VALUES ($1, $2, 'hash', 'salt', 'KV Tester', 'user', TRUE)
       ON CONFLICT (id) DO NOTHING`,
      [testUserId, 'kv_tester']
    );
  });

  afterAll(async () => {
    const pool = getPool();
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  it('can set, get, list and delete account-scoped user settings in PostgreSQL', async () => {
    const settingsPayload = {
      pdfProviderId: 'mineru',
      pdfProvidersConfig: {
        mineru: {
          baseUrl: 'http://192.168.121.150:8000',
          apiKey: '',
          enabled: true,
        },
      },
      updatedAt: Date.now(),
    };

    // 1. Set KV
    await setUserKV(testUserId, testKey, settingsPayload);

    // 2. Get KV
    const retrieved = await getUserKV<typeof settingsPayload>(testUserId, testKey);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.pdfProviderId).toBe('mineru');
    expect(retrieved?.pdfProvidersConfig.mineru.baseUrl).toBe('http://192.168.121.150:8000');

    // 3. List Keys
    const keys = await listUserKVKeys(testUserId, 'openmaic');
    expect(keys).toContain('openmaic-settings');

    // 4. Delete KV
    await deleteUserKV(testUserId, testKey);
    const afterDelete = await getUserKV(testUserId, testKey);
    expect(afterDelete).toBeNull();
  });
});
