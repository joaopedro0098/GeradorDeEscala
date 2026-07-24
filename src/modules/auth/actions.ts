'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  approveMembership,
  authenticateUser,
  AuthServiceError,
  completeOrganizationSelection,
  createOrganizationForAdmin,
  demoteAdmin,
  listActiveMembers,
  listPendingMembers,
  promoteMemberToAdmin,
  registerWithInviteCode,
  rejectMembership,
  removeMembership,
} from '@/modules/auth/auth.service';
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
import { prisma } from '@/lib/prisma';

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.'),
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
  inviteCode: z.string().trim().min(2, 'Informe o código da organização.'),
});

const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
  loginMode: z.enum(['user', 'admin']),
});

const createOrganizationSchema = z.object({
  organizationName: z.string().trim().min(2, 'Informe o nome da organização.'),
});

export type ActionState = {
  error?: string;
  success?: string;
};

function mapAuthError(error: unknown): ActionState {
  if (error instanceof AuthServiceError) {
    return { error: error.message };
  }

  if (error instanceof z.ZodError) {
    return { error: error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  return { error: 'Ocorreu um erro inesperado. Tente novamente.' };
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const parsed = registerSchema.parse({
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      inviteCode: formData.get('inviteCode'),
    });

    await registerWithInviteCode(parsed);
    return {
      success: 'Cadastro enviado. Aguarde a aprovação de um administrador para acessar o sistema.',
    };
  } catch (error) {
    return mapAuthError(error);
  }
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const parsed = loginSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
      loginMode: formData.get('loginMode'),
    });

    const { userId, result } = await authenticateUser(parsed);

    if (result.type === 'create_organization') {
      await setPendingLoginCookie({ userId, loginMode: parsed.loginMode });
      redirect('/criar-organizacao');
    }

    if (result.type === 'select_organization') {
      await setPendingLoginCookie({ userId, loginMode: parsed.loginMode });
      redirect('/selecionar-organizacao');
    }

    await clearPendingLoginCookie();
    await setSessionCookie(result.payload);
    redirect(getDefaultRedirectForLoginMode(parsed.loginMode));
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error;
    }
    return mapAuthError(error);
  }
}

export async function selectOrganizationAction(formData: FormData): Promise<void> {
  const membershipId = String(formData.get('membershipId') ?? '');
  const pending = await getPendingLoginFromCookies();

  if (!pending) {
    redirect('/login');
  }

  const result = await completeOrganizationSelection({
    userId: pending.userId,
    membershipId,
    loginMode: pending.loginMode,
  });

  if (result.type !== 'session') {
    redirect('/login');
  }

  await clearPendingLoginCookie();
  await setSessionCookie(result.payload);
  redirect(getDefaultRedirectForLoginMode(pending.loginMode));
}

export async function createOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const pending = await getPendingLoginFromCookies();
    if (!pending || pending.loginMode !== 'admin') {
      return { error: 'Sessão expirada. Faça login novamente.' };
    }

    const parsed = createOrganizationSchema.parse({
      organizationName: formData.get('organizationName'),
    });

    const result = await createOrganizationForAdmin({
      userId: pending.userId,
      organizationName: parsed.organizationName,
    });

    if (result.type !== 'session') {
      return { error: 'Não foi possível criar a organização.' };
    }

    await clearPendingLoginCookie();
    await setSessionCookie(result.payload);
    redirect('/admin');
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error;
    }
    return mapAuthError(error);
  }
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

export async function getOrganizationSelectionData() {
  const pending = await getPendingLoginFromCookies();
  if (!pending) return null;

  const memberships = await prisma.membership.findMany({
    where: { userId: pending.userId, status: 'ACTIVE' },
    include: { organization: { select: { name: true, inviteCode: true } } },
  });

  const filtered =
    pending.loginMode === 'admin'
      ? memberships.filter((membership) => membership.isAdmin)
      : memberships;

  return {
    pending,
    memberships: filtered.map((membership) => ({
      id: membership.id,
      organizationName: membership.organization.name,
      inviteCode: membership.organization.inviteCode,
    })),
  };
}
