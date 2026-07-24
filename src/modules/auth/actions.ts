'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  approveMembership,
  authenticateUser,
  buildSessionForMembership,
  createOrganizationForAdmin,
  demoteAdmin,
  joinOrganizationWithInviteCode,
  listActiveMembers,
  listMembershipsForUser,
  listPendingMembers,
  promoteMemberToAdmin,
  registerUser,
  rejectMembership,
  removeMembership,
} from '@/modules/auth/auth.service';
import { ActionState, handleActionError } from '@/modules/auth/action-errors';
import { resolveDefaultContext, normalizeEmail } from '@/modules/auth/auth-logic';
import {
  clearPendingLoginCookie,
  clearSessionCookie,
  getDefaultRedirectForLoginMode,
  getPendingLoginFromCookies,
  getSessionFromCookies,
  setPendingLoginCookie,
  setSessionCookie,
} from '@/modules/auth/session';
import { canManageAdminRoles, canManageMembers } from '@/modules/auth/permissions';
import { isPlanTier } from '@/modules/organizations/plans';
import { prisma } from '@/lib/prisma';
import type { LoginMode } from '@/modules/auth/types';

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.'),
  email: z.email('Informe um e-mail válido.').transform(normalizeEmail),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
});

const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.').transform(normalizeEmail),
  password: z.string().min(1, 'Informe sua senha.'),
});

const createOrganizationSchema = z.object({
  organizationName: z.string().trim().min(2, 'Informe o nome da organização.'),
  planTier: z.string().refine(isPlanTier, 'Selecione um plano.'),
});

const joinOrganizationSchema = z.object({
  inviteCode: z.string().trim().min(2, 'Informe o código da organização.'),
});

export type { ActionState } from '@/modules/auth/action-errors';

async function completeLoginForUser(userId: string): Promise<string> {
  const memberships = await listMembershipsForUser(userId);
  const result = resolveDefaultContext(userId, memberships);

  await clearPendingLoginCookie();

  if (result.type === 'no_active_organization') {
    await clearSessionCookie();
    await setPendingLoginCookie({ userId });
    return '/admin';
  }

  await setSessionCookie(result.payload);
  return getDefaultRedirectForLoginMode(result.payload.loginMode);
}

async function resolveActingUserId(): Promise<string | null> {
  const session = await getSessionFromCookies();
  if (session) return session.userId;

  const pending = await getPendingLoginFromCookies();
  return pending?.userId ?? null;
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let redirectTo: string;

  try {
    const parsed = registerSchema.parse({
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
    });

    const { userId } = await registerUser(parsed);
    redirectTo = await completeLoginForUser(userId);
  } catch (error) {
    return handleActionError(error);
  }

  redirect(redirectTo);
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let redirectTo: string;

  try {
    const parsed = loginSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    const { userId } = await authenticateUser(parsed);
    redirectTo = await completeLoginForUser(userId);
  } catch (error) {
    return handleActionError(error);
  }

  redirect(redirectTo);
}

export async function createOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let redirectTo: string | null = null;

  try {
    const session = await getSessionFromCookies();
    const pending = await getPendingLoginFromCookies();
    const userId = session?.userId ?? pending?.userId;

    if (!userId) {
      return { error: 'Sessão expirada. Faça login novamente.' };
    }

    const parsed = createOrganizationSchema.parse({
      organizationName: formData.get('organizationName'),
      planTier: formData.get('planTier'),
    });

    const created = await createOrganizationForAdmin({
      userId,
      organizationName: parsed.organizationName,
      planTier: parsed.planTier,
    });

    if (!session && pending) {
      const payload = await buildSessionForMembership({
        userId,
        membershipId: created.membershipId,
        loginMode: 'admin',
      });
      await clearPendingLoginCookie();
      await setSessionCookie(payload);
      redirectTo = '/admin';
    } else {
      revalidatePath('/admin/organizacoes');
      revalidatePath('/membro/organizacoes');
      return {
        success: `Organização "${created.organizationName}" criada. Ela já aparece na lista — troque quando quiser.`,
      };
    }
  } catch (error) {
    return handleActionError(error);
  }

  redirect(redirectTo!);
}

export async function joinOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const userId = await resolveActingUserId();
    if (!userId) {
      return { error: 'Sessão expirada. Faça login novamente.' };
    }

    const parsed = joinOrganizationSchema.parse({
      inviteCode: formData.get('inviteCode'),
    });

    await joinOrganizationWithInviteCode({
      userId,
      inviteCode: parsed.inviteCode,
    });

    revalidatePath('/admin/organizacoes');
    revalidatePath('/membro/organizacoes');
    return {
      success: 'Solicitação enviada. Aguarde a aprovação de um administrador.',
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function switchContextAction(formData: FormData): Promise<void> {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect('/login');
  }

  const membershipId = String(formData.get('membershipId') ?? '');
  const loginMode = String(formData.get('loginMode') ?? '') as LoginMode;

  if (!membershipId || (loginMode !== 'admin' && loginMode !== 'user')) {
    redirect('/admin/organizacoes');
  }

  const payload = await buildSessionForMembership({
    userId: session.userId,
    membershipId,
    loginMode,
  });

  await setSessionCookie(payload);
  redirect(getDefaultRedirectForLoginMode(payload.loginMode));
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  await clearPendingLoginCookie();
  redirect('/login');
}

export async function approveMemberAction(membershipId: string): Promise<void> {
  const session = await getSessionFromCookies();
  if (!session || !canManageMembers(session)) {
    return;
  }

  await approveMembership(membershipId, session.organizationId);
  revalidatePath('/admin/membros');
}

export async function rejectMemberAction(membershipId: string): Promise<void> {
  const session = await getSessionFromCookies();
  if (!session || !canManageMembers(session)) {
    return;
  }

  await rejectMembership(membershipId, session.organizationId);
  revalidatePath('/admin/membros');
}

export async function removeMemberAction(membershipId: string): Promise<void> {
  const session = await getSessionFromCookies();
  if (!session || !canManageMembers(session)) {
    return;
  }

  await removeMembership(membershipId, session.organizationId);
  revalidatePath('/admin/membros');
}

export async function promoteMemberAction(membershipId: string): Promise<void> {
  const session = await getSessionFromCookies();
  if (!session || !canManageAdminRoles(session)) {
    return;
  }

  await promoteMemberToAdmin({
    organizationId: session.organizationId,
    membershipId,
  });
  revalidatePath('/admin/membros');
}

export async function demoteAdminAction(membershipId: string): Promise<void> {
  const session = await getSessionFromCookies();
  if (!session || !canManageAdminRoles(session)) {
    return;
  }

  await demoteAdmin({
    organizationId: session.organizationId,
    membershipId,
  });
  revalidatePath('/admin/membros');
}

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const session = await getSessionFromCookies();
  if (!session) return;

  await prisma.notification.updateMany({
    where: { id: notificationId, membershipId: session.membershipId },
    data: { readAt: new Date() },
  });

  revalidatePath('/membro');
  revalidatePath('/admin');
}

export async function acceptAdminPromotionAction(notificationId: string): Promise<void> {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect('/login');
  }

  await prisma.notification.updateMany({
    where: { id: notificationId, membershipId: session.membershipId },
    data: { readAt: new Date() },
  });

  if (!session.isAdmin) {
    redirect('/membro');
  }

  const payload = await buildSessionForMembership({
    userId: session.userId,
    membershipId: session.membershipId,
    loginMode: 'admin',
  });

  await setSessionCookie(payload);
  redirect('/admin');
}

export async function getUnreadAdminPromotionNotification() {
  const session = await getSessionFromCookies();
  if (!session) return null;

  return prisma.notification.findFirst({
    where: {
      membershipId: session.membershipId,
      type: 'ADMIN_PROMOTED',
      readAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getMembersPageData() {
  const session = await getSessionFromCookies();
  if (!session || !canManageMembers(session)) {
    return null;
  }

  const [pending, active] = await Promise.all([
    listPendingMembers(session.organizationId),
    listActiveMembers(session.organizationId),
  ]);

  return {
    session,
    pending,
    active,
  };
}

export async function getOrganizationsPageData() {
  const session = await getSessionFromCookies();
  const pending = await getPendingLoginFromCookies();

  const userId = session?.userId ?? pending?.userId;
  if (!userId) return null;

  const memberships = await listMembershipsForUser(userId);

  return {
    session,
    pending,
    memberships,
  };
}
