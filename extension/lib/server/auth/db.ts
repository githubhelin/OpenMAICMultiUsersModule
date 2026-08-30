import { Pool } from 'pg';
import { nanoid } from 'nanoid';
import { hashPassword } from './crypto';
import type { User, SafeUser, UserRole } from './types';

let authPool: Pool | null = null;
let schemaInitPromise: Promise<void> | null = null;

function getPool(): Pool {
  if (!authPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured');
    }
    authPool = new Pool({ connectionString });
  }
  return authPool;
}

export function toSafeUser(user: User): SafeUser {
  const { password_hash, salt, ...safe } = user;
  return safe;
}

export async function ensureUserSchema(): Promise<void> {
  if (schemaInitPromise) return schemaInitPromise;

  schemaInitPromise = (async () => {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        nickname TEXT NOT NULL,
        avatar TEXT NOT NULL DEFAULT '/avatars/user.png',
        bio TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    // Ensure default initial admin exists
    const adminCheck = await pool.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['admin']);
    if (adminCheck.rows.length === 0) {
      const initialAdminUsername = process.env.INITIAL_ADMIN_USERNAME || 'admin';
      const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'admin123456';
      const { hash, salt } = await hashPassword(initialAdminPassword);
      const adminId = `usr_${nanoid(12)}`;

      await pool.query(
        `INSERT INTO users (id, username, password_hash, salt, nickname, role, is_active)
         VALUES ($1, $2, $3, $4, $5, 'admin', TRUE)
         ON CONFLICT (username) DO NOTHING`,
        [adminId, initialAdminUsername, hash, salt, 'Administrator']
      );
      console.log(`[Auth] Created default administrator: ${initialAdminUsername}`);
    }
  })();

  return schemaInitPromise;
}

export async function createUser(data: {
  username: string;
  password: string;
  email?: string | null;
  nickname?: string;
  avatar?: string;
  role?: UserRole;
}): Promise<SafeUser> {
  await ensureUserSchema();
  const pool = getPool();

  const existing = await pool.query(
    'SELECT id FROM users WHERE username = $1 OR (email IS NOT NULL AND email = $2)',
    [data.username.toLowerCase(), data.email || null]
  );
  if (existing.rows.length > 0) {
    throw new Error('Username or email already exists');
  }

  const { hash, salt } = await hashPassword(data.password);
  const id = `usr_${nanoid(12)}`;
  const nickname = data.nickname || data.username;
  const avatar = data.avatar || '/avatars/user.png';
  const role = data.role || 'user';

  const res = await pool.query<User>(
    `INSERT INTO users (id, username, email, password_hash, salt, nickname, avatar, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
     RETURNING *`,
    [id, data.username.toLowerCase(), data.email || null, hash, salt, nickname, avatar, role]
  );

  return toSafeUser(res.rows[0]);
}

export async function findUserByUsername(username: string): Promise<User | null> {
  await ensureUserSchema();
  const pool = getPool();
  const res = await pool.query<User>(
    'SELECT * FROM users WHERE username = $1 LIMIT 1',
    [username.toLowerCase()]
  );
  return res.rows[0] || null;
}

export async function findUserById(id: string): Promise<User | null> {
  await ensureUserSchema();
  const pool = getPool();
  const res = await pool.query<User>('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
  return res.rows[0] || null;
}

export async function updateUser(
  id: string,
  updates: Partial<{
    nickname: string;
    avatar: string;
    bio: string | null;
    email: string | null;
    password?: string;
    role: UserRole;
    is_active: boolean;
  }>
): Promise<SafeUser | null> {
  await ensureUserSchema();
  const pool = getPool();

  const setClauses: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [id];
  let paramIndex = 2;

  if (updates.nickname !== undefined) {
    setClauses.push(`nickname = $${paramIndex++}`);
    values.push(updates.nickname);
  }
  if (updates.avatar !== undefined) {
    setClauses.push(`avatar = $${paramIndex++}`);
    values.push(updates.avatar);
  }
  if (updates.bio !== undefined) {
    setClauses.push(`bio = $${paramIndex++}`);
    values.push(updates.bio);
  }
  if (updates.email !== undefined) {
    setClauses.push(`email = $${paramIndex++}`);
    values.push(updates.email);
  }
  if (updates.role !== undefined) {
    setClauses.push(`role = $${paramIndex++}`);
    values.push(updates.role);
  }
  if (updates.is_active !== undefined) {
    setClauses.push(`is_active = $${paramIndex++}`);
    values.push(updates.is_active);
  }
  if (updates.password) {
    const { hash, salt } = await hashPassword(updates.password);
    setClauses.push(`password_hash = $${paramIndex++}`);
    values.push(hash);
    setClauses.push(`salt = $${paramIndex++}`);
    values.push(salt);
  }

  const query = `
    UPDATE users
    SET ${setClauses.join(', ')}
    WHERE id = $1
    RETURNING *
  `;

  const res = await pool.query<User>(query, values);
  return res.rows[0] ? toSafeUser(res.rows[0]) : null;
}

export async function deleteUser(id: string): Promise<boolean> {
  await ensureUserSchema();
  const pool = getPool();
  const res = await pool.query('DELETE FROM users WHERE id = $1', [id]);
  return (res.rowCount ?? 0) > 0;
}

export async function listUsers(options?: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ users: SafeUser[]; total: number }> {
  await ensureUserSchema();
  const pool = getPool();
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;
  const search = options?.search?.trim();

  let whereClause = '';
  const values: unknown[] = [];

  if (search) {
    whereClause = 'WHERE username ILIKE $1 OR nickname ILIKE $1 OR email ILIKE $1';
    values.push(`%${search}%`);
  }

  const countRes = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM users ${whereClause}`,
    values
  );
  const total = parseInt(countRes.rows[0].count, 10);

  const queryValues = [...values, limit, offset];
  const limitParam = values.length + 1;
  const offsetParam = values.length + 2;

  const res = await pool.query<User>(
    `SELECT * FROM users ${whereClause} ORDER BY created_at DESC LIMIT $${limitParam} OFFSET $${offsetParam}`,
    queryValues
  );

  return {
    users: res.rows.map(toSafeUser),
    total,
  };
}
