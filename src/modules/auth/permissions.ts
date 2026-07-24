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

export function toSessionPayload(
  membership: MembershipSummary,
  loginMode: LoginMode,
): SessionPayload {
  return {
    userId: '',
    membershipId: membership.id,
    organizationId: membership.organizationId,
    organizationName: membership.organizationName,
    loginMode,
    isAdmin: membership.isAdmin,
    isPrimaryAdmin: membership.isPrimaryAdmin,
  };
}

export function attachUserId(payload: SessionPayload, userId: string): SessionPayload {
  return { ...payload, userId };
}
