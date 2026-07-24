import { describe, expect, it } from 'vitest';
import {
  canManageAdminRoles,
  canManageMembers,
  canViewPlans,
  filterMembershipsForLoginMode,
} from '@/modules/auth/permissions';
import type { MembershipSummary } from '@/modules/auth/types';

const membership = (overrides: Partial<MembershipSummary>): MembershipSummary => ({
  id: 'm1',
  organizationId: 'o1',
  organizationName: 'Org',
  inviteCode: 'ORG',
  status: 'ACTIVE',
  isAdmin: false,
  isPrimaryAdmin: false,
  ...overrides,
});

describe('permissions', () => {
  it('allows plans tab only for primary admin sessions', () => {
    expect(canViewPlans({ loginMode: 'admin', isPrimaryAdmin: true })).toBe(true);
    expect(canViewPlans({ loginMode: 'admin', isPrimaryAdmin: false })).toBe(false);
    expect(canViewPlans({ loginMode: 'user', isPrimaryAdmin: false })).toBe(false);
  });

  it('restricts admin role management to primary admin', () => {
    expect(canManageAdminRoles({ loginMode: 'admin', isPrimaryAdmin: true })).toBe(true);
    expect(canManageAdminRoles({ loginMode: 'admin', isPrimaryAdmin: false })).toBe(false);
  });

  it('allows any admin to manage members', () => {
    expect(canManageMembers({ loginMode: 'admin', isAdmin: true })).toBe(true);
    expect(canManageMembers({ loginMode: 'admin', isAdmin: false })).toBe(false);
  });

  it('filters memberships by login mode', () => {
    const memberships = [
      membership({ id: 'm1', isAdmin: true }),
      membership({ id: 'm2' }),
      membership({ id: 'm3', status: 'PENDING' }),
    ];

    expect(filterMembershipsForLoginMode(memberships, 'admin')).toHaveLength(1);
    expect(filterMembershipsForLoginMode(memberships, 'user')).toHaveLength(2);
  });
});
