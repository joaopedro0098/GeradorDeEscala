'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  approveMembership,
  authenticateUser,
  buildSessionForMembership,
  createOrganizationForAdmin,
  createTestMemberForOrganization,
  demoteAdmin,
  joinOrganizationWithInviteCode,
  listActiveMembers,
  listMembershipsForUser,
  listOrganizationRoles,
  listPendingMembers,
  promoteMemberToAdmin,
  registerUser,
  rejectMembership,
  removeMembership,
  setMembershipRolePreferences,
  updateOrganizationProfile,
  updateUserEmail,
  updateUserPassword,
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
import {
  canEditOrganizationProfile,
  canManageAdminRoles,
  canManageMembers,
  canViewPlans,
} from '@/modules/auth/permissions';
import { prisma } from '@/lib/prisma';
import { isDeveloperEmail } from '@/lib/developer';
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
});

const updateEmailSchema = z.object({
  email: z.email('Informe um e-mail válido.').transform(normalizeEmail),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe sua senha atual.'),
  newPassword: z.string().min(8, 'A nova senha deve ter pelo menos 8 caracteres.'),
  confirmPassword: z.string().min(1, 'Confirme a nova senha.'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'As senhas não coincidem.',
  path: ['confirmPassword'],
});

const updateOrganizationProfileSchema = z.object({
  organizationName: z.string().trim().min(2, 'Informe o nome da organização.'),
  logoDataUrl: z.string().optional(),
});

const joinOrganizationSchema = z.object({
  inviteCode: z.string().trim().min(2, 'Informe o código da organização.'),
});

const createTestMemberSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do membro.'),
  email: z.email('Informe um e-mail válido.').transform(normalizeEmail),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
});

export type { ActionState } from '@/modules/auth/action-errors';

async function completeLoginForUser(userId: string): Promise<string> {
  const memberships = await listMembershipsForUser(userId);
  const result = resolveDefaultContext(userId, memberships);

  await clearPendingLoginCookie();

  if (result.type === 'no_active_organization') {
    await clearSessionCookie();
    await setPendingLoginCookie({ userId });
    return '/admin/organizacoes';
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
    });

    const created = await createOrganizationForAdmin({
      userId,
      organizationName: parsed.organizationName,
    });

    if (!session && pending) {
      const payload = await buildSessionForMembership({
        userId,
        membershipId: created.membershipId,
        loginMode: 'admin',
      });
      await clearPendingLoginCookie();
      await setSessionCookie(payload);
      redirectTo = '/admin/escala';
    } else {
      revalidatePath('/admin/organizacoes');
      revalidatePath('/membro/organizacoes');
      revalidatePath('/admin/conta');
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
    const session = await getSessionFromCookies();
    if (session?.loginMode === 'admin') {
      return {
        error: 'Administradores não podem solicitar entrada em outra organização. Use a área de membro.',
      };
    }

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
  revalidatePath('/membro/escala');
  revalidatePath('/admin/escala');
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
    redirect('/membro/escala');
  }

  const payload = await buildSessionForMembership({
    userId: session.userId,
    membershipId: session.membershipId,
    loginMode: 'admin',
  });

  await setSessionCookie(payload);
  redirect('/admin/escala');
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

  const [pending, active, roles] = await Promise.all([
    listPendingMembers(session.organizationId),
    listActiveMembers(session.organizationId),
    listOrganizationRoles(session.organizationId),
  ]);

  return {
    session,
    pending,
    active,
    roles,
  };
}

export async function setMemberRolePreferencesAction(
  membershipId: string,
  orderedRoleIds: string[],
): Promise<{ error?: string }> {
  try {
    const session = await getSessionFromCookies();
    if (!session || !canManageMembers(session)) {
      return { error: 'Sem permissão.' };
    }

    await setMembershipRolePreferences({
      organizationId: session.organizationId,
      membershipId,
      orderedRoleIds,
    });
    revalidatePath('/admin/membros');
    return {};
  } catch (error) {
    return handleActionError(error);
  }
}

export async function getOrganizationsPageData() {
  const session = await getSessionFromCookies();
  const pending = await getPendingLoginFromCookies();

  const userId = session?.userId ?? pending?.userId;
  if (!userId) return null;

  const memberships = await listMembershipsForUser(userId);
  const canEditProfile = session ? canEditOrganizationProfile(session) : false;

  let organizationProfile: { name: string; logoUrl: string | null } | null = null;
  if (session && canEditProfile) {
    organizationProfile = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { name: true, logoUrl: true },
    });
  }

  return {
    session,
    pending,
    memberships,
    canEditProfile,
    organizationProfile,
  };
}

export async function updateEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const userId = await resolveActingUserId();
    if (!userId) {
      return { error: 'Sessão expirada. Faça login novamente.' };
    }

    const parsed = updateEmailSchema.parse({
      email: formData.get('email'),
    });

    await updateUserEmail({ userId, email: parsed.email });
    revalidatePath('/admin/conta');
    revalidatePath('/membro/conta');
    return { success: 'E-mail atualizado.' };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updatePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const userId = await resolveActingUserId();
    if (!userId) {
      return { error: 'Sessão expirada. Faça login novamente.' };
    }

    const parsed = updatePasswordSchema.parse({
      currentPassword: formData.get('currentPassword'),
      newPassword: formData.get('newPassword'),
      confirmPassword: formData.get('confirmPassword'),
    });

    await updateUserPassword({
      userId,
      currentPassword: parsed.currentPassword,
      newPassword: parsed.newPassword,
    });

    return { success: 'Senha atualizada.' };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateOrganizationProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await getSessionFromCookies();
    if (!session || !canEditOrganizationProfile(session)) {
      return { error: 'Apenas o admin principal pode editar o perfil da organização.' };
    }

    const logoRaw = String(formData.get('logoDataUrl') ?? '').trim();
    const parsed = updateOrganizationProfileSchema.parse({
      organizationName: formData.get('organizationName'),
      logoDataUrl: logoRaw || undefined,
    });

    const updated = await updateOrganizationProfile({
      organizationId: session.organizationId,
      name: parsed.organizationName,
      logoDataUrl: parsed.logoDataUrl,
    });

    await setSessionCookie({
      ...session,
      organizationName: updated.name,
      organizationLogoUrl: updated.logoUrl,
    });

    revalidatePath('/admin');
    revalidatePath('/membro');
    revalidatePath('/admin/organizacoes');
    revalidatePath('/membro/organizacoes');
    return { success: 'Perfil da organização atualizado.' };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function getAccountPageData() {
  const session = await getSessionFromCookies();
  const pending = await getPendingLoginFromCookies();
  const userId = session?.userId ?? pending?.userId;

  if (!userId) return null;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, name: true },
  });

  const showPlans = session ? canViewPlans(session) : false;

  if (!session || !showPlans) {
    return { user, session, organization: null };
  }

  const organization = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: {
      name: true,
      logoUrl: true,
      planTier: true,
      subscriptionStatus: true,
      trialStartedAt: true,
    },
  });

  return { user, session, organization };
}

async function assertDeveloperSession() {
  const session = await getSessionFromCookies();
  if (!session || session.loginMode !== 'admin') {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });

  if (!isDeveloperEmail(user?.email)) {
    return null;
  }

  return session;
}

export async function createTestMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await assertDeveloperSession();
    if (!session) {
      return { error: 'Acesso restrito ao desenvolvedor.' };
    }

    const parsed = createTestMemberSchema.parse({
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
    });

    const created = await createTestMemberForOrganization({
      organizationId: session.organizationId,
      name: parsed.name,
      email: parsed.email,
      password: parsed.password,
    });

    revalidatePath('/admin/membros');
    revalidatePath('/admin/dev/membros-teste');

    return {
      success: created.createdUser
        ? `Membro ${created.email} criado e ativo em "${session.organizationName}".`
        : `Conta existente vinculada como membro ativo em "${session.organizationName}".`,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
