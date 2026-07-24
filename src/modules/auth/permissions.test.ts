import { describe, expect, it } from 'vitest';
import {
  canManageAdminRoles,
  canManageMembers,
  canViewPlans,
  toSessionPayload,
} from '@/modules/auth/permissions';
import type { MembershipSummary } from '@/modules/auth/types';

const membership = (overrides: Partial<MembershipSummary> = {}): MembershipSummary => ({
  id: 'm1',
  organizationId: 'o1',
  organizationName: 'Org',
  organizationLogoUrl: null,
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

  it('builds session payload with organization name', () => {
    expect(toSessionPayload(membership({ organizationName: 'Louvor', isAdmin: true }), 'admin')).toMatchObject({
      organizationName: 'Louvor',
      loginMode: 'admin',
      isAdmin: true,
    });
  });
});
