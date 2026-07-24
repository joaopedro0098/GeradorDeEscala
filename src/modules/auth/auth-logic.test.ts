import { describe, expect, it } from 'vitest';
import { resolvePostLogin } from '@/modules/auth/auth-logic';
import type { MembershipSummary } from '@/modules/auth/types';

const baseMembership = (
  overrides: Partial<MembershipSummary> & Pick<MembershipSummary, 'id' | 'organizationId'>,
): MembershipSummary => ({
  organizationName: 'Org',
  inviteCode: 'ORG-1',
  status: 'ACTIVE',
  isAdmin: false,
  isPrimaryAdmin: false,
  ...overrides,
});

describe('resolvePostLogin', () => {
  it('redirects admin without admin memberships to create organization flow', () => {
    const result = resolvePostLogin(
      'user-1',
      [baseMembership({ id: 'm1', organizationId: 'o1' })],
      'admin',
    );

    expect(result).toEqual({ type: 'create_organization' });
  });

  it('creates a session when only one eligible membership exists', () => {
    const result = resolvePostLogin(
      'user-1',
      [
        baseMembership({
          id: 'm1',
          organizationId: 'o1',
          isAdmin: true,
          isPrimaryAdmin: true,
        }),
      ],
      'admin',
    );

    expect(result.type).toBe('session');
    if (result.type === 'session') {
      expect(result.payload).toMatchObject({
        userId: 'user-1',
        membershipId: 'm1',
        organizationId: 'o1',
        loginMode: 'admin',
        isAdmin: true,
        isPrimaryAdmin: true,
      });
    }
  });

  it('asks for organization selection when multiple memberships match', () => {
    const result = resolvePostLogin(
      'user-1',
      [
        baseMembership({ id: 'm1', organizationId: 'o1' }),
        baseMembership({ id: 'm2', organizationId: 'o2' }),
      ],
      'user',
    );

    expect(result.type).toBe('select_organization');
    if (result.type === 'select_organization') {
      expect(result.memberships).toHaveLength(2);
    }
  });

  it('throws when user mode has no active memberships', () => {
    expect(() =>
      resolvePostLogin(
        'user-1',
        [baseMembership({ id: 'm1', organizationId: 'o1', status: 'PENDING' })],
        'user',
      ),
    ).toThrow(/organização ativa/i);
  });
});
