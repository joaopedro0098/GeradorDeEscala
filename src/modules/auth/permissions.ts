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

export function canEditOrganizationProfile(
  session: Pick<SessionPayload, 'loginMode' | 'isPrimaryAdmin'>,
): boolean {
  return session.loginMode === 'admin' && session.isPrimaryAdmin;
}

/** Only primary admins (or users without an active team) can create a new team. */
export function canCreateTeam(memberships: MembershipSummary[]): boolean {
  const hasJoinedTeam = memberships.some(
    (membership) => membership.status === 'ACTIVE' && !membership.isPrimaryAdmin,
  );
  if (hasJoinedTeam) return false;

  const isPrimaryAdmin = memberships.some(
    (membership) => membership.status === 'ACTIVE' && membership.isPrimaryAdmin,
  );
  if (isPrimaryAdmin) return true;

  return !memberships.some((membership) => membership.status === 'ACTIVE');
}

/** Active membership in a team the user joined (not the billing primary admin). */
export function getAssociatedTeamMembership(
  memberships: MembershipSummary[],
  session: SessionPayload | null,
): MembershipSummary | null {
  const joinedMemberships = memberships.filter(
    (membership) => membership.status === 'ACTIVE' && !membership.isPrimaryAdmin,
  );

  if (joinedMemberships.length === 0) return null;

  if (session) {
    const currentJoined = joinedMemberships.find(
      (membership) => membership.id === session.membershipId,
    );
    if (currentJoined) return currentJoined;
  }

  return joinedMemberships[0] ?? null;
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
    organizationLogoUrl: membership.organizationLogoUrl,
    loginMode,
    isAdmin: membership.isAdmin,
    isPrimaryAdmin: membership.isPrimaryAdmin,
  };
}

export function attachUserId(payload: SessionPayload, userId: string): SessionPayload {
  return { ...payload, userId };
}
