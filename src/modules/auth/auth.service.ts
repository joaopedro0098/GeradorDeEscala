import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NotificationType, type PlanTier, type SubscriptionStatus } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { generateInviteCode, normalizeEmail } from '@/modules/auth/auth-logic';
import { hashPassword, verifyPassword } from '@/modules/auth/password';
import type { LoginMode, SessionPayload } from '@/modules/auth/types';
import {
  findMembershipByIdForUser,
  findOrganizationByInviteCode,
  findUserByEmail,
  listMembershipsForUser,
  mapMembershipSummary,
} from '@/modules/organizations/organization.repository';
import { attachUserId, toSessionPayload } from '@/modules/auth/permissions';

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ORGANIZATION_NOT_FOUND'
  | 'MEMBERSHIP_ALREADY_EXISTS'
  | 'MEMBERSHIP_NOT_FOUND'
  | 'EMAIL_ALREADY_EXISTS'
  | 'FORBIDDEN'
  | 'VALIDATION';

export class AuthServiceError extends Error {
  constructor(
    public code: AuthErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ userId: string }> {
  const email = normalizeEmail(input.email);
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    throw new AuthServiceError(
      'EMAIL_ALREADY_EXISTS',
      'Este e-mail já está cadastrado. Faça login.',
    );
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name.trim(),
      passwordHash,
    },
  });

  return { userId: user.id };
}

export async function joinOrganizationWithInviteCode(input: {
  userId: string;
  inviteCode: string;
}): Promise<void> {
  const organization = await findOrganizationByInviteCode(input.inviteCode);
  if (!organization) {
    throw new AuthServiceError('ORGANIZATION_NOT_FOUND', 'Código da organização inválido.');
  }

  const duplicateMembership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: input.userId,
        organizationId: organization.id,
      },
    },
  });

  if (duplicateMembership) {
    throw new AuthServiceError(
      'MEMBERSHIP_ALREADY_EXISTS',
      'Você já possui vínculo com esta organização.',
    );
  }

  await prisma.membership.create({
    data: {
      userId: input.userId,
      organizationId: organization.id,
      status: 'PENDING',
    },
  });
}

export async function createTestMemberForOrganization(input: {
  organizationId: string;
  name: string;
  email: string;
  password: string;
}): Promise<{ userId: string; membershipId: string; email: string; createdUser: boolean }> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();

  if (name.length < 2) {
    throw new AuthServiceError('VALIDATION', 'Informe o nome do membro.');
  }
  if (input.password.length < 8) {
    throw new AuthServiceError('VALIDATION', 'A senha deve ter pelo menos 8 caracteres.');
  }

  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true },
  });
  if (!organization) {
    throw new AuthServiceError('ORGANIZATION_NOT_FOUND', 'Organização não encontrada.');
  }

  const passwordHash = await hashPassword(input.password);

  let user = await findUserByEmail(email);
  let createdUser = false;

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
      },
    });
    createdUser = true;
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        passwordHash,
      },
    });
  }

  const existingMembership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: input.organizationId,
      },
    },
  });

  if (existingMembership) {
    const membership = await prisma.membership.update({
      where: { id: existingMembership.id },
      data: {
        status: 'ACTIVE',
        isAdmin: false,
        isPrimaryAdmin: false,
      },
    });

    return {
      userId: user.id,
      membershipId: membership.id,
      email,
      createdUser,
    };
  }

  const membership = await prisma.membership.create({
    data: {
      userId: user.id,
      organizationId: input.organizationId,
      status: 'ACTIVE',
      isAdmin: false,
      isPrimaryAdmin: false,
    },
  });

  return {
    userId: user.id,
    membershipId: membership.id,
    email,
    createdUser,
  };
}

export async function authenticateUser(input: {
  email: string;
  password: string;
}): Promise<{ userId: string }> {
  const user = await findUserByEmail(normalizeEmail(input.email));
  if (!user) {
    throw new AuthServiceError('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new AuthServiceError('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
  }

  return { userId: user.id };
}

export async function buildSessionForMembership(input: {
  userId: string;
  membershipId: string;
  loginMode: LoginMode;
}): Promise<SessionPayload> {
  const membership = await findMembershipByIdForUser(input.membershipId, input.userId);
  if (!membership) {
    throw new AuthServiceError('MEMBERSHIP_NOT_FOUND', 'Organização não encontrada.');
  }

  const summary = mapMembershipSummary(membership);

  if (summary.status !== 'ACTIVE') {
    throw new AuthServiceError('FORBIDDEN', 'Este vínculo ainda não está ativo.');
  }

  if (input.loginMode === 'admin' && !summary.isAdmin) {
    throw new AuthServiceError('FORBIDDEN', 'Você não é administrador desta organização.');
  }

  return attachUserId(toSessionPayload(summary, input.loginMode), input.userId);
}

export async function createOrganizationForAdmin(input: {
  userId: string;
  organizationName: string;
  planTier?: PlanTier;
}): Promise<{
  organizationId: string;
  membershipId: string;
  organizationName: string;
  inviteCode: string;
}> {
  const inviteCode = generateInviteCode(input.organizationName);
  const hasActiveSubscription = await userHasActiveSubscription(input.userId);
  const subscriptionStatus: SubscriptionStatus = hasActiveSubscription ? 'ACTIVE' : 'TRIAL';

  const organization = await prisma.organization.create({
    data: {
      name: input.organizationName.trim(),
      inviteCode,
      planTier: input.planTier ?? 'BASIC',
      subscriptionStatus,
      trialStartedAt: new Date(),
      memberships: {
        create: {
          userId: input.userId,
          status: 'ACTIVE',
          isAdmin: true,
          isPrimaryAdmin: true,
        },
      },
    },
    include: {
      memberships: {
        where: { userId: input.userId },
        take: 1,
      },
    },
  });

  const membership = organization.memberships[0];

  return {
    organizationId: organization.id,
    membershipId: membership.id,
    organizationName: organization.name,
    inviteCode: organization.inviteCode,
  };
}

async function userHasActiveSubscription(userId: string): Promise<boolean> {
  const activeOrg = await prisma.organization.findFirst({
    where: {
      subscriptionStatus: 'ACTIVE',
      memberships: {
        some: {
          userId,
          isPrimaryAdmin: true,
          status: 'ACTIVE',
        },
      },
    },
    select: { id: true },
  });

  return activeOrg !== null;
}

export async function updateUserEmail(input: {
  userId: string;
  email: string;
}): Promise<void> {
  const email = normalizeEmail(input.email);
  const existingUser = await findUserByEmail(email);

  if (existingUser && existingUser.id !== input.userId) {
    throw new AuthServiceError('EMAIL_ALREADY_EXISTS', 'Este e-mail já está em uso.');
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: { email },
  });
}

export async function updateUserPassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });
  const passwordMatches = await verifyPassword(input.currentPassword, user.passwordHash);

  if (!passwordMatches) {
    throw new AuthServiceError('INVALID_CREDENTIALS', 'Senha atual incorreta.');
  }

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.user.update({
    where: { id: input.userId },
    data: { passwordHash },
  });
}

export async function updateOrganizationProfile(input: {
  organizationId: string;
  name: string;
  logoDataUrl?: string | null;
}): Promise<{ name: string; logoUrl: string | null }> {
  const name = input.name.trim();
  if (name.length < 2) {
    throw new AuthServiceError('VALIDATION', 'Informe o nome da organização.');
  }

  let logoUrl: string | null | undefined;

  if (input.logoDataUrl) {
    logoUrl = await saveOrganizationLogo(input.organizationId, input.logoDataUrl);
  }

  const organization = await prisma.organization.update({
    where: { id: input.organizationId },
    data: {
      name,
      ...(logoUrl !== undefined ? { logoUrl } : {}),
    },
    select: { name: true, logoUrl: true },
  });

  return organization;
}

async function saveUserProfilePhoto(userId: string, dataUrl: string): Promise<string> {
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match) {
    throw new AuthServiceError('VALIDATION', 'Imagem inválida. Use JPG, PNG ou WebP.');
  }

  const buffer = Buffer.from(match[2], 'base64');
  const maxBytes = 800_000;
  if (buffer.length > maxBytes) {
    throw new AuthServiceError('VALIDATION', 'A imagem é muito grande. Tente com zoom menor.');
  }

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'users');
  await mkdir(uploadsDir, { recursive: true });

  const filename = `${userId}.jpg`;
  await writeFile(path.join(uploadsDir, filename), buffer);

  return `/uploads/users/${filename}?v=${Date.now()}`;
}

export async function updateUserProfile(input: {
  userId: string;
  name: string;
  profilePhotoDataUrl?: string | null;
}): Promise<{ name: string; profilePhotoUrl: string | null }> {
  const name = input.name.trim();
  if (name.length < 2) {
    throw new AuthServiceError('VALIDATION', 'Informe o nome do perfil.');
  }

  let profilePhotoUrl: string | null | undefined;

  if (input.profilePhotoDataUrl) {
    profilePhotoUrl = await saveUserProfilePhoto(input.userId, input.profilePhotoDataUrl);
  }

  const user = await prisma.user.update({
    where: { id: input.userId },
    data: {
      name,
      ...(profilePhotoUrl !== undefined ? { profilePhotoUrl } : {}),
    },
    select: { name: true, profilePhotoUrl: true },
  });

  return user;
}

async function saveOrganizationLogo(organizationId: string, dataUrl: string): Promise<string> {
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match) {
    throw new AuthServiceError('VALIDATION', 'Imagem inválida. Use JPG, PNG ou WebP.');
  }

  const buffer = Buffer.from(match[2], 'base64');
  const maxBytes = 800_000;
  if (buffer.length > maxBytes) {
    throw new AuthServiceError('VALIDATION', 'A imagem é muito grande. Tente com zoom menor.');
  }

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'organizations');
  await mkdir(uploadsDir, { recursive: true });

  const filename = `${organizationId}.jpg`;
  await writeFile(path.join(uploadsDir, filename), buffer);

  return `/uploads/organizations/${filename}?v=${Date.now()}`;
}

export async function listPendingMembers(organizationId: string) {
  return prisma.membership.findMany({
    where: { organizationId, status: 'PENDING' },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function listActiveMembers(organizationId: string) {
  return prisma.membership.findMany({
    where: { organizationId, status: 'ACTIVE' },
    include: {
      user: { select: { id: true, name: true, email: true, profilePhotoUrl: true } },
      rolePreferences: {
        orderBy: { sortOrder: 'asc' },
        select: {
          sortOrder: true,
          role: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function approveMembership(membershipId: string, organizationId: string) {
  return prisma.membership.updateMany({
    where: { id: membershipId, organizationId, status: 'PENDING' },
    data: { status: 'ACTIVE' },
  });
}

export async function rejectMembership(membershipId: string, organizationId: string) {
  return prisma.membership.updateMany({
    where: { id: membershipId, organizationId, status: 'PENDING' },
    data: { status: 'REJECTED' },
  });
}

export async function removeMembership(membershipId: string, organizationId: string) {
  return prisma.membership.deleteMany({
    where: { id: membershipId, organizationId },
  });
}

export async function leaveOrganization(input: { membershipId: string; userId: string }) {
  const membership = await prisma.membership.findFirst({
    where: {
      id: input.membershipId,
      userId: input.userId,
      status: 'ACTIVE',
      isPrimaryAdmin: false,
    },
    include: {
      user: { select: { name: true, email: true } },
      organization: { select: { name: true } },
    },
  });

  if (!membership) {
    throw new AuthServiceError('FORBIDDEN', 'Não foi possível sair desta equipe.');
  }

  const adminMemberships = await prisma.membership.findMany({
    where: {
      organizationId: membership.organizationId,
      isAdmin: true,
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const admin of adminMemberships) {
      await tx.notification.create({
        data: {
          membershipId: admin.id,
          type: NotificationType.MEMBER_DISASSOCIATED,
          title: 'Desassociação',
          message: `${membership.user.name} se desassociou de ${membership.organization.name}.`,
        },
      });
    }

    await tx.membership.delete({ where: { id: membership.id } });
  });
}

export async function listDisassociationNotifications(membershipId: string) {
  return prisma.notification.findMany({
    where: {
      membershipId,
      type: NotificationType.MEMBER_DISASSOCIATED,
      readAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listOrganizationRoles(organizationId: string) {
  return prisma.role.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}

/**
 * Replaces a member's instrument/voice preferences. `orderedRoleIds` is
 * preference order (index 0 = most preferred). Empty clears all preferences.
 */
export async function setMembershipRolePreferences(input: {
  organizationId: string;
  membershipId: string;
  orderedRoleIds: string[];
}) {
  const membership = await prisma.membership.findFirst({
    where: {
      id: input.membershipId,
      organizationId: input.organizationId,
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  if (!membership) {
    throw new AuthServiceError('FORBIDDEN', 'Membro não encontrado.');
  }

  const uniqueRoleIds = [...new Set(input.orderedRoleIds)];
  if (uniqueRoleIds.length !== input.orderedRoleIds.length) {
    throw new AuthServiceError('VALIDATION', 'Lista de funções inválida.');
  }

  if (uniqueRoleIds.length > 0) {
    const roles = await prisma.role.findMany({
      where: { organizationId: input.organizationId, id: { in: uniqueRoleIds } },
      select: { id: true },
    });
    if (roles.length !== uniqueRoleIds.length) {
      throw new AuthServiceError('VALIDATION', 'Uma ou mais funções não existem nesta organização.');
    }
  }

  await prisma.$transaction([
    prisma.membershipRolePreference.deleteMany({ where: { membershipId: membership.id } }),
    ...input.orderedRoleIds.map((roleId, index) =>
      prisma.membershipRolePreference.create({
        data: {
          membershipId: membership.id,
          roleId,
          sortOrder: index + 1,
        },
      }),
    ),
  ]);
}

export async function promoteMemberToAdmin(input: {
  organizationId: string;
  membershipId: string;
}) {
  const membership = await prisma.membership.findFirst({
    where: {
      id: input.membershipId,
      organizationId: input.organizationId,
      status: 'ACTIVE',
      isAdmin: false,
    },
  });

  if (!membership) {
    throw new AuthServiceError('FORBIDDEN', 'Não foi possível promover este membro.');
  }

  await prisma.membership.update({
    where: { id: membership.id },
    data: { isAdmin: true },
  });

  await prisma.notification.create({
    data: {
      membershipId: membership.id,
      type: NotificationType.ADMIN_PROMOTED,
      title: 'Promoção a Admin',
      message:
        'Você foi promovido a Admin. Use o botão "Ver como Admin" no cabeçalho para acessar a área administrativa, sem precisar sair e entrar de novo.',
    },
  });

  return membership;
}

export async function demoteAdmin(input: { organizationId: string; membershipId: string }) {
  const membership = await prisma.membership.findFirst({
    where: {
      id: input.membershipId,
      organizationId: input.organizationId,
      isAdmin: true,
      isPrimaryAdmin: false,
    },
  });

  if (!membership) {
    throw new AuthServiceError('FORBIDDEN', 'Não foi possível remover privilégios de admin.');
  }

  return prisma.membership.update({
    where: { id: membership.id },
    data: { isAdmin: false },
  });
}

export { listMembershipsForUser };
