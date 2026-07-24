import { NotificationType } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { generateInviteCode } from '@/modules/auth/auth-logic';
import { hashPassword, verifyPassword } from '@/modules/auth/password';
import type { LoginMode, PostLoginResult } from '@/modules/auth/types';
import { resolvePostLogin } from '@/modules/auth/auth-logic';
import {
  findMembershipByIdForUser,
  findOrganizationByInviteCode,
  findUserByEmail,
  listMembershipsForUser,
  mapMembershipSummary,
} from '@/modules/organizations/organization.repository';

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ORGANIZATION_NOT_FOUND'
  | 'MEMBERSHIP_ALREADY_EXISTS'
  | 'MEMBERSHIP_NOT_FOUND'
  | 'FORBIDDEN';

export class AuthServiceError extends Error {
  constructor(
    public code: AuthErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export async function registerWithInviteCode(input: {
  name: string;
  email: string;
  password: string;
  inviteCode: string;
}): Promise<void> {
  const organization = await findOrganizationByInviteCode(input.inviteCode);
  if (!organization) {
    throw new AuthServiceError('ORGANIZATION_NOT_FOUND', 'Código da organização inválido.');
  }

  const email = input.email.toLowerCase();
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    const passwordMatches = await verifyPassword(input.password, existingUser.passwordHash);
    if (!passwordMatches) {
      throw new AuthServiceError(
        'INVALID_CREDENTIALS',
        'E-mail já cadastrado. Use a senha correta.',
      );
    }

    const duplicateMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: existingUser.id,
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
        userId: existingUser.id,
        organizationId: organization.id,
        status: 'PENDING',
      },
    });

    return;
  }

  const passwordHash = await hashPassword(input.password);

  await prisma.user.create({
    data: {
      email,
      name: input.name.trim(),
      passwordHash,
      memberships: {
        create: {
          organizationId: organization.id,
          status: 'PENDING',
        },
      },
    },
  });
}

export async function authenticateUser(input: {
  email: string;
  password: string;
  loginMode: LoginMode;
}): Promise<{ userId: string; result: PostLoginResult }> {
  const user = await findUserByEmail(input.email);
  if (!user) {
    throw new AuthServiceError('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new AuthServiceError('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
  }

  const memberships = await listMembershipsForUser(user.id);
  const result = resolvePostLogin(user.id, memberships, input.loginMode);

  if (result.type === 'session' && input.loginMode === 'user') {
    const membership = memberships.find((item) => item.id === result.payload.membershipId);
    if (membership?.status === 'PENDING') {
      throw new AuthServiceError(
        'FORBIDDEN',
        'Seu cadastro ainda aguarda aprovação de um administrador.',
      );
    }
  }

  return { userId: user.id, result };
}

export async function completeOrganizationSelection(input: {
  userId: string;
  membershipId: string;
  loginMode: LoginMode;
}): Promise<PostLoginResult> {
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

  return {
    type: 'session',
    payload: {
      userId: input.userId,
      membershipId: summary.id,
      organizationId: summary.organizationId,
      loginMode: input.loginMode,
      isAdmin: summary.isAdmin,
      isPrimaryAdmin: summary.isPrimaryAdmin,
    },
  };
}

export async function createOrganizationForAdmin(input: {
  userId: string;
  organizationName: string;
}): Promise<PostLoginResult> {
  const inviteCode = generateInviteCode(input.organizationName);

  const organization = await prisma.organization.create({
    data: {
      name: input.organizationName.trim(),
      inviteCode,
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
    type: 'session',
    payload: {
      userId: input.userId,
      membershipId: membership.id,
      organizationId: organization.id,
      loginMode: 'admin',
      isAdmin: true,
      isPrimaryAdmin: true,
    },
  };
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
    include: { user: { select: { id: true, name: true, email: true } } },
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
      message: 'Você foi promovido a Admin, clique aqui.',
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
