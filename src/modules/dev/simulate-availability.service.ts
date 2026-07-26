import { prisma } from '@/lib/prisma';
import { listOrganizationEventsForMonth } from '@/modules/availability/availability.service';
import { pickRandomEventIds } from '@/modules/dev/simulate-availability.logic';
import { countAssignmentsByMember } from '@/modules/scheduling/schedule.logic';
import { ensureWorkingMonth } from '@/modules/scheduling/working-month.service';
import type { YearMonth } from '@/modules/scheduling/working-month.logic';

export class DevSimulateAvailabilityError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export type DevActiveMember = {
  membershipId: string;
  name: string;
};

export type DevAssignmentMatrix = {
  roles: Array<{ id: string; name: string }>;
  members: Array<{ membershipId: string; name: string }>;
  /** counts[membershipId][roleId] = times scheduled in that role this month */
  counts: Record<string, Record<string, number>>;
  hasSchedule: boolean;
  year: number;
  month: number;
};

export async function listActiveMembersForDev(organizationId: string): Promise<DevActiveMember[]> {
  const memberships = await prisma.membership.findMany({
    where: { organizationId, status: 'ACTIVE' },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return memberships.map((membership) => ({
    membershipId: membership.id,
    name: membership.user.name,
  }));
}

/**
 * Overwrites availability for the working-month cult events only.
 * Prior months are untouched (equity history preserved).
 */
export async function replaceAvailabilitiesForWorkingMonth(input: {
  organizationId: string;
  memberDayCounts: Array<{ membershipId: string; dayCount: number }>;
}): Promise<{ year: number; month: number; eventCount: number; memberCount: number }> {
  if (input.memberDayCounts.length === 0) {
    throw new DevSimulateAvailabilityError('Nenhum membro para atualizar.');
  }

  for (const entry of input.memberDayCounts) {
    if (!Number.isInteger(entry.dayCount) || entry.dayCount < 0) {
      throw new DevSimulateAvailabilityError('Quantidade de dias inválida.');
    }
  }

  const workingMonth = await ensureWorkingMonth(input.organizationId);
  const events = await listOrganizationEventsForMonth(
    input.organizationId,
    workingMonth.year,
    workingMonth.month,
  );
  const eventIds = events.map((event) => event.id);

  const membershipIds = input.memberDayCounts.map((entry) => entry.membershipId);
  const active = await prisma.membership.findMany({
    where: {
      organizationId: input.organizationId,
      status: 'ACTIVE',
      id: { in: membershipIds },
    },
    select: { id: true },
  });
  const activeIds = new Set(active.map((item) => item.id));
  const invalid = membershipIds.filter((id) => !activeIds.has(id));
  if (invalid.length > 0) {
    throw new DevSimulateAvailabilityError('Um ou mais membros são inválidos para esta organização.');
  }

  const rows: Array<{ membershipId: string; eventId: string }> = [];
  for (const entry of input.memberDayCounts) {
    for (const eventId of pickRandomEventIds(eventIds, entry.dayCount)) {
      rows.push({ membershipId: entry.membershipId, eventId });
    }
  }

  await prisma.$transaction(async (tx) => {
    if (eventIds.length > 0) {
      await tx.availability.deleteMany({
        where: {
          membershipId: { in: membershipIds },
          eventId: { in: eventIds },
        },
      });
    }

    if (rows.length > 0) {
      await tx.availability.createMany({ data: rows });
    }
  });

  return {
    year: workingMonth.year,
    month: workingMonth.month,
    eventCount: eventIds.length,
    memberCount: membershipIds.length,
  };
}

export async function getDevAssignmentMatrix(
  organizationId: string,
  workingMonth: YearMonth,
): Promise<DevAssignmentMatrix> {
  const [roles, members, schedule] = await Promise.all([
    prisma.role.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    listActiveMembersForDev(organizationId),
    prisma.schedule.findUnique({
      where: {
        organizationId_year_month: {
          organizationId,
          year: workingMonth.year,
          month: workingMonth.month,
        },
      },
      include: {
        slots: {
          select: {
            membershipId: true,
            roleId: true,
            role: { select: { name: true } },
            membership: { select: { user: { select: { name: true } } } },
          },
        },
      },
    }),
  ]);

  const counts: Record<string, Record<string, number>> = {};
  for (const member of members) {
    counts[member.membershipId] = {};
    for (const role of roles) {
      counts[member.membershipId][role.id] = 0;
    }
  }

  if (schedule) {
    const tallies = countAssignmentsByMember(
      schedule.slots.map((slot) => ({
        membershipId: slot.membershipId,
        memberName: slot.membership?.user.name ?? null,
        roleId: slot.roleId,
        roleName: slot.role.name,
      })),
    );

    for (const member of tallies) {
      if (!counts[member.membershipId]) {
        counts[member.membershipId] = {};
        for (const role of roles) {
          counts[member.membershipId][role.id] = 0;
        }
      }
      for (const roleEntry of member.byRole) {
        counts[member.membershipId][roleEntry.roleId] = roleEntry.count;
      }
    }
  }

  return {
    roles,
    members: members.map((member) => ({
      membershipId: member.membershipId,
      name: member.name,
    })),
    counts,
    hasSchedule: Boolean(schedule && schedule.slots.length > 0),
    year: workingMonth.year,
    month: workingMonth.month,
  };
}
