import { redirect } from 'next/navigation';
import { isDeveloperEmail } from '@/lib/developer';
import { prisma } from '@/lib/prisma';
import { listMembershipsForUser } from '@/modules/auth/auth.service';
import { getPendingLoginFromCookies, getSessionFromCookies } from '@/modules/auth/session';
import type { MembershipSummary, SessionPayload } from '@/modules/auth/types';

export type AppShellContext = {
  userId: string;
  userEmail: string;
  isDeveloper: boolean;
  session: SessionPayload | null;
  memberships: MembershipSummary[];
  hasActiveOrganization: boolean;
};

export async function getAppShellContext(options?: {
  loginMode?: 'admin' | 'user';
}): Promise<AppShellContext | null> {
  const session = await getSessionFromCookies();
  const pending = await getPendingLoginFromCookies();
  const userId = session?.userId ?? pending?.userId;

  if (!userId) return null;

  if (session && options?.loginMode && session.loginMode !== options.loginMode) {
    redirect(options.loginMode === 'admin' ? '/membro/escala' : '/admin/escala');
  }

  const [memberships, user] = await Promise.all([
    listMembershipsForUser(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    }),
  ]);
  const hasActiveOrganization = memberships.some((membership) => membership.status === 'ACTIVE');
  const userEmail = user?.email ?? '';

  return {
    userId,
    userEmail,
    isDeveloper: isDeveloperEmail(userEmail),
    session,
    memberships,
    hasActiveOrganization,
  };
}

export async function requireOrganizationSession(options?: {
  loginMode?: 'admin' | 'user';
}): Promise<SessionPayload> {
  const session = await getSessionFromCookies();

  if (!session) {
    const pending = await getPendingLoginFromCookies();
    if (pending) redirect('/admin/organizacoes');
    redirect('/login');
  }

  if (options?.loginMode && session.loginMode !== options.loginMode) {
    redirect(options.loginMode === 'admin' ? '/membro/escala' : '/admin/escala');
  }

  return session;
}
