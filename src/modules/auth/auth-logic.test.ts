import { describe, expect, it } from 'vitest';
import { normalizeEmail, resolveDefaultContext } from '@/modules/auth/auth-logic';
import type { MembershipSummary } from '@/modules/auth/types';

const baseMembership = (
  overrides: Partial<MembershipSummary> & Pick<MembershipSummary, 'id' | 'organizationId'>,
): MembershipSummary => ({
  organizationName: 'Org',
  organizationLogoUrl: null,
  inviteCode: 'ORG-1',
  status: 'ACTIVE',
  isAdmin: false,
  isPrimaryAdmin: false,
  ...overrides,
});

describe('normalizeEmail', () => {
  it('trims whitespace and lowercases the address', () => {
    expect(normalizeEmail('  Joao@Test.COM  ')).toBe('joao@test.com');
  });
});

describe('resolveDefaultContext', () => {
  it('returns no_active_organization when there are no ACTIVE memberships', () => {
    expect(resolveDefaultContext('user-1', [])).toEqual({ type: 'no_active_organization' });

    expect(
      resolveDefaultContext('user-1', [
        baseMembership({ id: 'm1', organizationId: 'o1', status: 'PENDING' }),
      ]),
    ).toEqual({ type: 'no_active_organization' });
  });

  it('opens as user when the only ACTIVE membership is non-admin', () => {
    const result = resolveDefaultContext('user-1', [
      baseMembership({ id: 'm1', organizationId: 'o1', organizationName: 'Louvor' }),
    ]);

    expect(result.type).toBe('session');
    if (result.type === 'session') {
      expect(result.payload).toMatchObject({
        userId: 'user-1',
        membershipId: 'm1',
        organizationId: 'o1',
        organizationName: 'Louvor',
        loginMode: 'user',
        isAdmin: false,
      });
    }
  });

  it('opens as admin when the only ACTIVE membership is admin', () => {
    const result = resolveDefaultContext('user-1', [
      baseMembership({
        id: 'm1',
        organizationId: 'o1',
        isAdmin: true,
        isPrimaryAdmin: true,
      }),
    ]);

    expect(result.type).toBe('session');
    if (result.type === 'session') {
      expect(result.payload.loginMode).toBe('admin');
      expect(result.payload.isPrimaryAdmin).toBe(true);
    }
  });

  it('prefers primary admin over other admin over oldest membership', () => {
    const result = resolveDefaultContext('user-1', [
      baseMembership({ id: 'm-old', organizationId: 'o1', organizationName: 'Antiga' }),
      baseMembership({
        id: 'm-admin',
        organizationId: 'o2',
        organizationName: 'Admin Org',
        isAdmin: true,
      }),
      baseMembership({
        id: 'm-primary',
        organizationId: 'o3',
        organizationName: 'Primary Org',
        isAdmin: true,
        isPrimaryAdmin: true,
      }),
    ]);

    expect(result.type).toBe('session');
    if (result.type === 'session') {
      expect(result.payload.membershipId).toBe('m-primary');
      expect(result.payload.loginMode).toBe('admin');
    }
  });

  it('prefers admin over non-admin when no primary admin exists', () => {
    const result = resolveDefaultContext('user-1', [
      baseMembership({ id: 'm-member', organizationId: 'o1' }),
      baseMembership({
        id: 'm-admin',
        organizationId: 'o2',
        isAdmin: true,
      }),
    ]);

    expect(result.type).toBe('session');
    if (result.type === 'session') {
      expect(result.payload.membershipId).toBe('m-admin');
      expect(result.payload.loginMode).toBe('admin');
    }
  });
});
