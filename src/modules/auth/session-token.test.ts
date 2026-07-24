/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { createSessionToken, verifySessionToken } from '@/modules/auth/session-token';

describe('session tokens', () => {
  it('creates and verifies a session payload', async () => {
    const token = await createSessionToken({
      userId: 'user-1',
      membershipId: 'membership-1',
      organizationId: 'org-1',
      organizationName: 'Org Teste',
      organizationLogoUrl: null,
      loginMode: 'admin',
      isAdmin: true,
      isPrimaryAdmin: true,
    });

    const payload = await verifySessionToken(token);
    expect(payload).toMatchObject({
      userId: 'user-1',
      membershipId: 'membership-1',
      organizationId: 'org-1',
      organizationName: 'Org Teste',
      organizationLogoUrl: null,
      loginMode: 'admin',
    });
  });
});
