import { prisma } from '@/lib/prisma';
import {
  buildSubmitConfirmation,
  type SubmitConfirmation,
} from '@/modules/availability/availability.logic';

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

export async function getMinimumParticipationDays(organizationId: string): Promise<number> {
  const config = await prisma.participationConfig.findUnique({
    where: { organizationId },
  });
  return config?.minimumDays ?? 0;
}

export async function listOrganizationEventsForMonth(
  organizationId: string,
  year: number,
  month: number,
) {
  const { start, end } = monthRange(year, month);
  const events = await prisma.event.findMany({
    where: {
      organizationId,
      date: {
        gte: start,
        lte: end,
      },
    },
    orderBy: { date: 'asc' },
  });

  return events.map((event) => ({
    id: event.id,
    date: event.date.toISOString().slice(0, 10),
  }));
}

export async function listMemberAvailabilityEventIds(
  membershipId: string,
  eventIds: string[],
): Promise<string[]> {
  if (eventIds.length === 0) return [];

  const availabilities = await prisma.availability.findMany({
    where: {
      membershipId,
      eventId: { in: eventIds },
    },
    select: { eventId: true },
  });

  return availabilities.map((item) => item.eventId);
}

export async function countMemberMarkedDaysInMonth(
  membershipId: string,
  organizationId: string,
  year: number,
  month: number,
): Promise<number> {
  const { start, end } = monthRange(year, month);
  return prisma.availability.count({
    where: {
      membershipId,
      event: {
        organizationId,
        date: {
          gte: start,
          lte: end,
        },
      },
    },
  });
}

export async function toggleMemberAvailability(input: {
  membershipId: string;
  organizationId: string;
  eventId: string;
}): Promise<boolean> {
  const event = await prisma.event.findFirst({
    where: {
      id: input.eventId,
      organizationId: input.organizationId,
    },
  });

  if (!event) {
    throw new Error('Evento não encontrado.');
  }

  const existing = await prisma.availability.findUnique({
    where: {
      membershipId_eventId: {
        membershipId: input.membershipId,
        eventId: input.eventId,
      },
    },
  });

  if (existing) {
    await prisma.availability.delete({ where: { id: existing.id } });
    return false;
  }

  await prisma.availability.create({
    data: {
      membershipId: input.membershipId,
      eventId: input.eventId,
    },
  });

  return true;
}

export async function getMemberAvailabilitySubmissionPreview(input: {
  membershipId: string;
  organizationId: string;
  year: number;
  month: number;
}): Promise<SubmitConfirmation> {
  const minimumDays = await getMinimumParticipationDays(input.organizationId);
  const selectedDays = await countMemberMarkedDaysInMonth(
    input.membershipId,
    input.organizationId,
    input.year,
    input.month,
  );

  return buildSubmitConfirmation(selectedDays, minimumDays);
}
