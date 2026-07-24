import type { LoginMode, MembershipSummary, PostLoginResult } from './types';
import { attachUserId, filterMembershipsForLoginMode, toSessionPayload } from './permissions';

export function resolvePostLogin(
  userId: string,
  memberships: MembershipSummary[],
  loginMode: LoginMode,
): PostLoginResult {
  const eligible = filterMembershipsForLoginMode(memberships, loginMode);

  if (loginMode === 'admin' && eligible.length === 0) {
    return { type: 'create_organization' };
  }

  if (eligible.length === 0) {
    throw new Error('Nenhuma organização ativa encontrada para este login.');
  }

  if (eligible.length === 1) {
    return {
      type: 'session',
      payload: attachUserId(toSessionPayload(eligible[0], loginMode), userId),
    };
  }

  return { type: 'select_organization', memberships: eligible };
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
