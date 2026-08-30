import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword, signToken, verifyToken } from '@/lib/server/auth/crypto';

describe('Auth Crypto utilities', () => {
  it('correctly hashes and verifies passwords', async () => {
    const password = 'mySecretPassword123!';
    const { hash, salt } = await hashPassword(password);
    
    expect(hash).toBeDefined();
    expect(salt).toBeDefined();
    expect(hash.length).toBeGreaterThan(20);

    const valid = await verifyPassword(password, hash, salt);
    expect(valid).toBe(true);

    const invalid = await verifyPassword('wrongPassword', hash, salt);
    expect(invalid).toBe(false);
  });

  it('correctly signs and verifies JWT session tokens', () => {
    const payload = {
      userId: 'usr_test123',
      username: 'testuser',
      role: 'user' as const,
      nickname: 'Tester',
      avatar: '/avatars/user.png',
    };

    const token = signToken(payload, 3600);
    expect(token).toBeDefined();
    expect(token.split('.').length).toBe(3);

    const verified = verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe('usr_test123');
    expect(verified?.username).toBe('testuser');
    expect(verified?.role).toBe('user');
  });

  it('rejects tampered or expired tokens', () => {
    const payload = {
      userId: 'usr_test123',
      username: 'testuser',
      role: 'user' as const,
      nickname: 'Tester',
      avatar: '/avatars/user.png',
    };

    // Tampered token
    const token = signToken(payload, 3600);
    const tampered = token.slice(0, -5) + 'xxxxx';
    expect(verifyToken(tampered)).toBeNull();

    // Expired token (expires in -1 second)
    const expiredToken = signToken(payload, -1);
    expect(verifyToken(expiredToken)).toBeNull();
  });
});
