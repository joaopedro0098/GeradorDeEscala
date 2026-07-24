import type { MembershipSummary, PostLoginResult } from './types';
import { attachUserId, toSessionPayload } from './permissions';

/**
 * Picks the default organization context after login (no Admin/User radio).
 * Priority among ACTIVE memberships: primary admin > admin > oldest.
 * loginMode follows isAdmin on the chosen membership.
 */
export function resolveDefaultContext(
  userId: string,
  memberships: MembershipSummary[],
): PostLoginResult {
  const active = memberships.filter((membership) => membership.status === 'ACTIVE');

  if (active.length === 0) {
    return { type: 'no_active_organization' };
  }

  const chosen =
    active.find((membership) => membership.isPrimaryAdmin) ??
    active.find((membership) => membership.isAdmin) ??
    active[0];

  const loginMode = chosen.isAdmin ? 'admin' : 'user';

  return {
    type: 'session',
    payload: attachUserId(toSessionPayload(chosen, loginMode), userId),
  };
}

export function slugifyInviteCode(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
}

export function generateInviteCode(baseName: string): string {
  const slug = slugifyInviteCode(baseName);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return slug ? `${slug}-${suffix}` : suffix;
}
