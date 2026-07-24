import type { LoginMode, MembershipSummary, SessionPayload } from './types';

export function canViewPlans(
  session: Pick<SessionPayload, 'loginMode' | 'isPrimaryAdmin'>,
): boolean {
  return session.loginMode === 'admin' && session.isPrimaryAdmin;
}

export function canManageAdminRoles(
  session: Pick<SessionPayload, 'loginMode' | 'isPrimaryAdmin'>,
): boolean {
  return session.loginMode === 'admin' && session.isPrimaryAdmin;
}

export function canManageMembers(session: Pick<SessionPayload, 'loginMode' | 'isAdmin'>): boolean {
  return session.loginMode === 'admin' && session.isAdmin;
}

export function filterMembershipsForLoginMode(
  memberships: MembershipSummary[],
  loginMode: LoginMode,
): MembershipSummary[] {
  const active = memberships.filter((membership) => membership.status === 'ACTIVE');

  if (loginMode === 'admin') {
    return active.filter((membership) => membership.isAdmin);
  }

  return active;
}

export function toSessionPayload(
  membership: MembershipSummary,
  loginMode: LoginMode,
): SessionPayload {
  return {
    userId: '',
    membershipId: membership.id,
    organizationId: membership.organizationId,
    loginMode,
    isAdmin: membership.isAdmin,
    isPrimaryAdmin: membership.isPrimaryAdmin,
  };
}

export function attachUserId(payload: SessionPayload, userId: string): SessionPayload {
  return { ...payload, userId };
}
