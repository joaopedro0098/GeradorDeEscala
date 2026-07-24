import { NotificationType, type PlanTier } from '@/generated/prisma/client';
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
  | 'FORBIDDEN';

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
  planTier: PlanTier;
}): Promise<{
  organizationId: string;
  membershipId: string;
  organizationName: string;
  inviteCode: string;
}> {
  const inviteCode = generateInviteCode(input.organizationName);

  const organization = await prisma.organization.create({
    data: {
      name: input.organizationName.trim(),
      inviteCode,
      planTier: input.planTier,
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
