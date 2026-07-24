import { prisma } from '@/lib/prisma';
import type { MembershipSummary } from '@/modules/auth/types';
import { normalizeEmail } from '@/modules/auth/auth-logic';

type MembershipWithOrganization = {
  id: string;
  organizationId: string;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED';
  isAdmin: boolean;
  isPrimaryAdmin: boolean;
  organization: {
    name: string;
    logoUrl: string | null;
    inviteCode: string;
  };
};

export function mapMembershipSummary(membership: MembershipWithOrganization): MembershipSummary {
  return {
    id: membership.id,
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    organizationLogoUrl: membership.organization.logoUrl,
    inviteCode: membership.organization.inviteCode,
    status: membership.status,
    isAdmin: membership.isAdmin,
    isPrimaryAdmin: membership.isPrimaryAdmin,
  };
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
  });
}

export async function listMembershipsForUser(userId: string): Promise<MembershipSummary[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: {
      organization: {
        select: { name: true, logoUrl: true, inviteCode: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return memberships.map(mapMembershipSummary);
}

export async function findOrganizationByInviteCode(inviteCode: string) {
  return prisma.organization.findUnique({
    where: { inviteCode: inviteCode.trim().toUpperCase() },
  });
}

export async function findMembershipByIdForUser(membershipId: string, userId: string) {
  return prisma.membership.findFirst({
    where: { id: membershipId, userId },
    include: {
      organization: {
        select: { name: true, logoUrl: true, inviteCode: true },
      },
    },
  });
}
