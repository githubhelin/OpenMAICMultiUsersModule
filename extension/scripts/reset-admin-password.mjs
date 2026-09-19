#!/usr/bin/env node
import { scrypt, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const scryptAsync = promisify(scrypt);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 1. 读取 .env.local
const envPath = path.join(root, '.env.local');
let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=')) {
      databaseUrl = trimmed.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
      break;
    }
  }
}

if (!databaseUrl) {
  console.error('❌ 错误: 未在环境或 .env.local 中找到 DATABASE_URL');
  process.exit(1);
}

const targetUser = process.argv[2] || 'admin';
const newPassword = process.argv[3] || 'admin123456';

async function main() {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = await scryptAsync(newPassword, salt, 64);
    const hash = derivedKey.toString('hex');

    const res = await pool.query(
      `UPDATE users SET password_hash = $1, salt = $2, is_active = TRUE, updated_at = NOW() WHERE username = $3 RETURNING id, username, role`,
      [hash, salt, targetUser]
    );

    if (res.rowCount === 0) {
      console.log(`⚠️ 未找到用户 [${targetUser}]，正在为您创建该管理员账号...`);
      const adminId = `usr_${randomBytes(6).toString('hex')}`;
      await pool.query(
        `INSERT INTO users (id, username, password_hash, salt, nickname, role, is_active)
         VALUES ($1, $2, $3, $4, $5, 'admin', TRUE)`,
        [adminId, targetUser, hash, salt, 'Administrator']
      );
      console.log(`🎉 管理员账号 [${targetUser}] 创建成功！`);
    } else {
      console.log(`🎉 账号 [${targetUser}] 密码已成功重置！`);
    }

    console.log(`--------------------------------------------------`);
    console.log(`  用户名: ${targetUser}`);
    console.log(`  新密码: ${newPassword}`);
    console.log(`--------------------------------------------------`);
  } catch (err) {
    console.error('❌ 操作失败:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
