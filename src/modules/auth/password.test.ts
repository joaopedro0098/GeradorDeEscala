import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/modules/auth/password';

describe('password helpers', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('senha-segura-123');
    expect(hash).not.toBe('senha-segura-123');
    await expect(verifyPassword('senha-segura-123', hash)).resolves.toBe(true);
    await expect(verifyPassword('outra-senha', hash)).resolves.toBe(false);
  });
});
