import { prisma } from '@/lib/prisma';
import { getDayOfWeekFromDateKey } from './configuration.logic';
import {
  buildSolverGroups,
  buildSolverInput,
  expandRequirementsForEvents,
} from './schedule-builder';
import { applyMinisterSelection, countAssignmentsByMember, groupSlotsByEvent } from './schedule.logic';
import type { ScheduleOverview, ShortageEntryView } from './schedule.types';
import { computeShortage } from './shortage-check';
import { solveSchedule } from './solver.engine';
import type { SolverEventInput, SolverGroupMode, SolverStatus } from './solver.types';

export class ScheduleServiceError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

async function loadEventsForMonth(
  organizationId: string,
  year: number,
  month: number,
): Promise<SolverEventInput[]> {
  const { start, end } = monthRange(year, month);
  const events = await prisma.event.findMany({
    where: { organizationId, date: { gte: start, lte: end } },
    orderBy: { date: 'asc' },
  });

  return events.map((event) => {
    const dateKey = event.date.toISOString().slice(0, 10);
    return { id: event.id, date: dateKey, dayOfWeek: getDayOfWeekFromDateKey(dateKey) };
  });
}

async function loadActiveMembers(organizationId: string, eventIds: string[]) {
  const memberships = await prisma.membership.findMany({
    where: { organizationId, status: 'ACTIVE' },
    include: {
      rolePreferences: { select: { roleId: true, sortOrder: true } },
      roleCombinations: { select: { roleAId: true, roleBId: true } },
      availabilities: { where: { eventId: { in: eventIds } }, select: { eventId: true } },
    },
  });

  return memberships.map((membership) => ({
    membershipId: membership.id,
    availableEventIds: membership.availabilities.map((availability) => availability.eventId),
    rolePreferences: membership.rolePreferences,
    compatibleRolePairs: membership.roleCombinations.map((combo) => ({
      roleAId: combo.roleAId,
      roleBId: combo.roleBId,
    })),
  }));
}

async function loadIntervalRules(organizationId: string) {
  const rules = await prisma.intervalRule.findMany({ where: { organizationId } });
  return rules.map((rule) => ({
    roleId: rule.roleId,
    intervalCount: rule.intervalCount,
    countMode: rule.countMode,
  }));
}

async function loadPriorityRoles(organizationId: string) {
  const roles = await prisma.priorityRole.findMany({ where: { organizationId } });
  return roles.map((role) => ({ roleId: role.roleId, sortOrder: role.sortOrder }));
}

async function loadDayRequirements(organizationId: string) {
  return prisma.dayOfWeekRequirement.findMany({
    where: { organizationId },
    select: { dayOfWeek: true, roleId: true, quantity: true },
  });
}

async function loadGroups(
  organizationId: string,
): Promise<Array<{ id: string; mode: SolverGroupMode; membershipIds: string[] }>> {
  const groups = await prisma.memberGroup.findMany({
    where: { organizationId },
    include: {
      members: {
        where: { membership: { status: 'ACTIVE' } },
        select: { membershipId: true },
      },
    },
  });

  return groups.map((group) => ({
    id: group.id,
    mode: group.mode,
    membershipIds: group.members.map((member) => member.membershipId),
  }));
}

/**
 * Prior-month equity signal (4.3 tie-break), sourced only from a PUBLISHED
 * previous schedule (per the confirmed decision). If the previous month has
 * no schedule, or it was never published, this returns no history — equity
 * for that tie-break is treated as zeroed rather than guessed at.
 */
async function loadPriorMonthSlots(organizationId: string, year: number, month: number) {
  const prior = previousMonth(year, month);
  const priorSchedule = await prisma.schedule.findUnique({
    where: {
      organizationId_year_month: { organizationId, year: prior.year, month: prior.month },
    },
    include: { slots: { select: { membershipId: true, roleId: true } } },
  });

  if (!priorSchedule || priorSchedule.status !== 'PUBLISHED') return [];
  return priorSchedule.slots;
}

async function buildSchedulingContext(organizationId: string, year: number, month: number) {
  const events = await loadEventsForMonth(organizationId, year, month);
  const eventIds = events.map((event) => event.id);

  const [members, intervalRules, priorityRoles, dayRequirements, groups, priorMonthSlots] =
    await Promise.all([
      loadActiveMembers(organizationId, eventIds),
      loadIntervalRules(organizationId),
      loadPriorityRoles(organizationId),
      loadDayRequirements(organizationId),
      loadGroups(organizationId),
      loadPriorMonthSlots(organizationId, year, month),
    ]);

  return { events, members, intervalRules, priorityRoles, dayRequirements, groups, priorMonthSlots };
}

export async function getPreGenerationShortagePreview(
  organizationId: string,
  year: number,
  month: number,
): Promise<ShortageEntryView[]> {
  const context = await buildSchedulingContext(organizationId, year, month);
  const requirements = expandRequirementsForEvents(context.events, context.dayRequirements);

  const shortages = computeShortage({
    requirements,
    members: context.members,
    events: context.events,
    intervalRules: context.intervalRules,
    groups: buildSolverGroups(context.groups),
  });

  if (shortages.length === 0) return [];

  const roles = await prisma.role.findMany({ where: { organizationId }, select: { id: true, name: true } });
  const roleNameById = new Map(roles.map((role) => [role.id, role.name]));
  const eventDateById = new Map(context.events.map((event) => [event.id, event.date]));

  return shortages
    .map((shortage) => ({
      eventId: shortage.eventId,
      eventDate: eventDateById.get(shortage.eventId) ?? '',
      roleId: shortage.roleId,
      roleName: roleNameById.get(shortage.roleId) ?? 'Função',
      quantityNeeded: shortage.quantityNeeded,
      availableCandidates: shortage.availableCandidates,
      missing: shortage.missing,
    }))
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.roleName.localeCompare(b.roleName));
}

export async function generateSchedule(
  organizationId: string,
  year: number,
  month: number,
): Promise<{ scheduleId: string; status: SolverStatus; blankCount: number }> {
  const context = await buildSchedulingContext(organizationId, year, month);

  const solverInput = buildSolverInput({
    events: context.events,
    dayRequirements: context.dayRequirements,
    members: context.members,
    intervalRules: context.intervalRules,
    priorityRoles: context.priorityRoles,
    priorMonthSlots: context.priorMonthSlots,
    groups: context.groups,
  });

  const result = solveSchedule(solverInput);

  const schedule = await prisma.schedule.upsert({
    where: { organizationId_year_month: { organizationId, year, month } },
    update: {
      status: 'DRAFT',
      generationStatus: result.status,
      hasPublishedGaps: false,
      publishedAt: null,
    },
    create: {
      organizationId,
      year,
      month,
      status: 'DRAFT',
      generationStatus: result.status,
    },
  });

  await prisma.$transaction([
    prisma.scheduleSlot.deleteMany({ where: { scheduleId: schedule.id } }),
    prisma.scheduleSlot.createMany({
      data: result.slots.map((slot) => ({
        scheduleId: schedule.id,
        eventId: slot.eventId,
        roleId: slot.roleId,
        slotIndex: slot.slotIndex,
        membershipId: slot.membershipId,
      })),
    }),
  ]);

  return {
    scheduleId: schedule.id,
    status: result.status,
    blankCount: result.unfilledSlots.length,
  };
}

async function loadScheduleOverview(
  organizationId: string,
  year: number,
  month: number,
  options: { requirePublished: boolean; includeMemberCounts: boolean },
): Promise<ScheduleOverview | null> {
  const schedule = await prisma.schedule.findUnique({
    where: { organizationId_year_month: { organizationId, year, month } },
    include: {
      slots: {
        include: {
          role: { select: { name: true } },
          event: { select: { id: true, date: true } },
          membership: { include: { user: { select: { name: true } } } },
        },
      },
    },
  });

  if (!schedule) return null;
  if (options.requirePublished && schedule.status !== 'PUBLISHED') return null;

  const eventsById = new Map<string, { eventId: string; date: string; dayOfWeek: SolverEventInput['dayOfWeek'] }>();
  const slots = schedule.slots.map((slot) => {
    const dateKey = slot.event.date.toISOString().slice(0, 10);
    if (!eventsById.has(slot.event.id)) {
      eventsById.set(slot.event.id, {
        eventId: slot.event.id,
        date: dateKey,
        dayOfWeek: getDayOfWeekFromDateKey(dateKey),
      });
    }

    return {
      id: slot.id,
      eventId: slot.event.id,
      roleId: slot.roleId,
      roleName: slot.role.name,
      slotIndex: slot.slotIndex,
      membershipId: slot.membershipId,
      memberName: slot.membership?.user.name ?? null,
      isManual: slot.isManual,
      isMinister: slot.isMinister,
    };
  });

  return {
    scheduleId: schedule.id,
    year: schedule.year,
    month: schedule.month,
    status: schedule.status,
    generationStatus: schedule.generationStatus,
    hasPublishedGaps: schedule.hasPublishedGaps,
    publishedAt: schedule.publishedAt ? schedule.publishedAt.toISOString() : null,
    events: groupSlotsByEvent([...eventsById.values()], slots),
    memberCounts: options.includeMemberCounts ? countAssignmentsByMember(slots) : [],
  };
}

export async function getScheduleOverviewForAdmin(
  organizationId: string,
  year: number,
  month: number,
): Promise<ScheduleOverview | null> {
  return loadScheduleOverview(organizationId, year, month, {
    requirePublished: false,
    includeMemberCounts: true,
  });
}

export async function getScheduleOverviewForMember(
  organizationId: string,
  year: number,
  month: number,
): Promise<ScheduleOverview | null> {
  return loadScheduleOverview(organizationId, year, month, {
    requirePublished: true,
    includeMemberCounts: false,
  });
}

export async function publishSchedule(organizationId: string, year: number, month: number): Promise<void> {
  const schedule = await prisma.schedule.findUnique({
    where: { organizationId_year_month: { organizationId, year, month } },
    include: { slots: { select: { membershipId: true } } },
  });

  if (!schedule) {
    throw new ScheduleServiceError('Gere a escala antes de publicar.');
  }

  const hasGaps = schedule.slots.some((slot) => slot.membershipId === null);

  await prisma.schedule.update({
    where: { id: schedule.id },
    data: {
      status: 'PUBLISHED',
      hasPublishedGaps: hasGaps,
      publishedAt: new Date(),
    },
  });
}

export async function setScheduleSlotMinister(
  organizationId: string,
  scheduleSlotId: string,
): Promise<void> {
  const slot = await prisma.scheduleSlot.findFirst({
    where: { id: scheduleSlotId, schedule: { organizationId } },
  });

  if (!slot) {
    throw new ScheduleServiceError('Vaga não encontrada.');
  }

  if (!slot.membershipId) {
    throw new ScheduleServiceError('Não é possível marcar uma vaga em branco como ministro.');
  }

  const eventSlots = await prisma.scheduleSlot.findMany({
    where: { scheduleId: slot.scheduleId, eventId: slot.eventId },
    select: { id: true, membershipId: true, isMinister: true },
  });

  const updated = applyMinisterSelection(eventSlots, scheduleSlotId);

  await prisma.$transaction(
    updated
      .filter((entry, index) => entry.isMinister !== eventSlots[index].isMinister)
      .map((entry) =>
        prisma.scheduleSlot.update({
          where: { id: entry.id },
          data: { isMinister: entry.isMinister },
        }),
      ),
  );
}
