import type {
  Prisma,
  ScheduleGenerationStatus,
  ScheduleStatus,
} from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getDayOfWeekFromDateKey } from './configuration.logic';
import {
  buildManualPinnedSlots,
  buildSolverGroups,
  buildSolverInput,
  expandRequirementsForEvents,
} from './schedule-builder';
import { applyMinisterSelection, countAssignmentsByMember, groupSlotsByEvent } from './schedule.logic';
import type {
  ScheduleAssignmentCandidate,
  ScheduleOverview,
  ShortageEntryView,
} from './schedule.types';
import {
  getMemberVisibleSlotSource,
  isMemberScheduleVisible,
  resolveHasPendingDraftAfterRegenerate,
  resolveHasPendingDraftAfterUndo,
  shouldFreezeSnapshotBeforeUndo,
  shouldFreezeSnapshotOnRegenerateFromPublished,
  shouldSavePreviousVersionBeforeOverwrite,
  type ScheduleSlotSnapshot,
  type ScheduleVisibilityState,
} from './schedule.version.logic';
import { computeShortage } from './shortage-check';
import { solveSchedule } from './solver.engine';
import type { SolverEventInput, SolverGroupMode, SolverStatus } from './solver.types';

export class ScheduleServiceError extends Error {
  constructor(message: string) {
    super(message);
  }
}

type Tx = Prisma.TransactionClient;

type WorkingSlot = ScheduleSlotSnapshot;

type ScheduleMetadataSnapshot = {
  statusAtSave: ScheduleStatus;
  generationStatus: ScheduleGenerationStatus | null;
  hasPublishedGaps: boolean;
  publishedAt: Date | null;
};

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function visibilityState(schedule: {
  status: ScheduleStatus;
  hasPendingDraft: boolean;
  publishedSnapshotId: string | null;
}): ScheduleVisibilityState {
  return {
    status: schedule.status,
    hasPendingDraft: schedule.hasPendingDraft,
    publishedSnapshotId: schedule.publishedSnapshotId,
  };
}

function toWorkingSlot(slot: {
  eventId: string;
  roleId: string;
  slotIndex: number;
  membershipId: string | null;
  isManual: boolean;
  isMinister: boolean;
}): WorkingSlot {
  return {
    eventId: slot.eventId,
    roleId: slot.roleId,
    slotIndex: slot.slotIndex,
    membershipId: slot.membershipId,
    isManual: slot.isManual,
    isMinister: slot.isMinister,
  };
}

function workingSlotKey(slot: { eventId: string; roleId: string; slotIndex: number }): string {
  return `${slot.eventId}::${slot.roleId}::${slot.slotIndex}`;
}

async function savePreviousVersion(
  tx: Tx,
  scheduleId: string,
  slots: WorkingSlot[],
  metadata: ScheduleMetadataSnapshot,
): Promise<void> {
  const previous = await tx.schedulePreviousVersion.upsert({
    where: { scheduleId },
    create: {
      scheduleId,
      statusAtSave: metadata.statusAtSave,
      generationStatus: metadata.generationStatus,
      hasPublishedGaps: metadata.hasPublishedGaps,
      publishedAt: metadata.publishedAt,
    },
    update: {
      savedAt: new Date(),
      statusAtSave: metadata.statusAtSave,
      generationStatus: metadata.generationStatus,
      hasPublishedGaps: metadata.hasPublishedGaps,
      publishedAt: metadata.publishedAt,
    },
  });

  await tx.schedulePreviousVersionSlot.deleteMany({ where: { previousId: previous.id } });
  if (slots.length > 0) {
    await tx.schedulePreviousVersionSlot.createMany({
      data: slots.map((slot) => ({
        previousId: previous.id,
        eventId: slot.eventId,
        roleId: slot.roleId,
        slotIndex: slot.slotIndex,
        membershipId: slot.membershipId,
        isManual: slot.isManual,
        isMinister: slot.isMinister,
      })),
    });
  }
}

async function freezePublishedSnapshot(
  tx: Tx,
  scheduleId: string,
  slots: WorkingSlot[],
  metadata: {
    generationStatus: ScheduleGenerationStatus | null;
    hasPublishedGaps: boolean;
    publishedAt: Date | null;
  },
): Promise<void> {
  const schedule = await tx.schedule.findUniqueOrThrow({ where: { id: scheduleId } });

  if (schedule.publishedSnapshotId) {
    await tx.schedulePublishedSnapshot.delete({ where: { id: schedule.publishedSnapshotId } });
  }

  const snapshot = await tx.schedulePublishedSnapshot.create({
    data: {
      generationStatus: metadata.generationStatus,
      hasPublishedGaps: metadata.hasPublishedGaps,
      publishedAt: metadata.publishedAt,
      slots: {
        create: slots.map((slot) => ({
          eventId: slot.eventId,
          roleId: slot.roleId,
          slotIndex: slot.slotIndex,
          membershipId: slot.membershipId,
          isManual: slot.isManual,
          isMinister: slot.isMinister,
        })),
      },
    },
  });

  await tx.schedule.update({
    where: { id: scheduleId },
    data: { publishedSnapshotId: snapshot.id },
  });
}

async function replaceWorkingSlots(tx: Tx, scheduleId: string, slots: WorkingSlot[]): Promise<void> {
  await tx.scheduleSlot.deleteMany({ where: { scheduleId } });
  if (slots.length === 0) return;

  await tx.scheduleSlot.createMany({
    data: slots.map((slot) => ({
      scheduleId,
      eventId: slot.eventId,
      roleId: slot.roleId,
      slotIndex: slot.slotIndex,
      membershipId: slot.membershipId,
      isManual: slot.isManual,
      isMinister: slot.isMinister,
    })),
  });
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

async function loadIntervalRule(organizationId: string) {
  const rule = await prisma.intervalRule.findUnique({ where: { organizationId } });
  if (!rule) return null;
  return { intervalCount: rule.intervalCount, countMode: rule.countMode };
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

async function loadPriorMonthSlots(organizationId: string, year: number, month: number) {
  const prior = previousMonth(year, month);
  const priorSchedule = await prisma.schedule.findUnique({
    where: {
      organizationId_year_month: { organizationId, year: prior.year, month: prior.month },
    },
    include: {
      slots: { select: { membershipId: true, roleId: true } },
      publishedSnapshot: {
        include: { slots: { select: { membershipId: true, roleId: true } } },
      },
    },
  });

  if (!priorSchedule) return [];

  const source = getMemberVisibleSlotSource(visibilityState(priorSchedule));
  if (source === 'snapshot') return priorSchedule.publishedSnapshot?.slots ?? [];
  if (source === 'working') return priorSchedule.slots;
  return [];
}

async function buildSchedulingContext(organizationId: string, year: number, month: number) {
  const events = await loadEventsForMonth(organizationId, year, month);
  const eventIds = events.map((event) => event.id);

  const [members, intervalRule, priorityRoles, dayRequirements, groups, priorMonthSlots] =
    await Promise.all([
      loadActiveMembers(organizationId, eventIds),
      loadIntervalRule(organizationId),
      loadPriorityRoles(organizationId),
      loadDayRequirements(organizationId),
      loadGroups(organizationId),
      loadPriorMonthSlots(organizationId, year, month),
    ]);

  return { events, members, intervalRule, priorityRoles, dayRequirements, groups, priorMonthSlots };
}

type LookupMaps = {
  roleNameById: Map<string, string>;
  eventById: Map<string, { id: string; date: Date }>;
  memberNameById: Map<string, string>;
};

async function buildLookupMaps(organizationId: string, slotRows: WorkingSlot[]): Promise<LookupMaps> {
  const eventIds = [...new Set(slotRows.map((slot) => slot.eventId))];
  const roleIds = [...new Set(slotRows.map((slot) => slot.roleId))];
  const membershipIds = [
    ...new Set(slotRows.map((slot) => slot.membershipId).filter(Boolean)),
  ] as string[];

  const [events, roles, memberships] = await Promise.all([
    prisma.event.findMany({
      where: { organizationId, id: { in: eventIds } },
      select: { id: true, date: true },
    }),
    prisma.role.findMany({
      where: { organizationId, id: { in: roleIds } },
      select: { id: true, name: true },
    }),
    membershipIds.length > 0
      ? prisma.membership.findMany({
          where: { id: { in: membershipIds } },
          include: { user: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  return {
    roleNameById: new Map(roles.map((role) => [role.id, role.name])),
    eventById: new Map(events.map((event) => [event.id, event])),
    memberNameById: new Map(memberships.map((membership) => [membership.id, membership.user.name])),
  };
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
    intervalRule: context.intervalRule,
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
  options?: { keepManual?: boolean },
): Promise<{ scheduleId: string; status: SolverStatus; blankCount: number }> {
  const existing = await prisma.schedule.findUnique({
    where: { organizationId_year_month: { organizationId, year, month } },
    include: { slots: true },
  });

  const context = await buildSchedulingContext(organizationId, year, month);
  const manualPinnedSlots =
    options?.keepManual && existing
      ? buildManualPinnedSlots(existing.slots.map(toWorkingSlot))
      : undefined;

  const solverInput = buildSolverInput({
    events: context.events,
    dayRequirements: context.dayRequirements,
    members: context.members,
    intervalRule: context.intervalRule,
    priorityRoles: context.priorityRoles,
    priorMonthSlots: context.priorMonthSlots,
    groups: context.groups,
    pinnedSlots: manualPinnedSlots,
  });

  const result = solveSchedule(solverInput);

  const manualKeys = new Set(
    options?.keepManual && existing
      ? existing.slots.filter((slot) => slot.isManual).map((slot) => workingSlotKey(slot))
      : [],
  );
  const ministerByManualKey = new Map(
    options?.keepManual && existing
      ? existing.slots
          .filter((slot) => slot.isManual)
          .map((slot) => [workingSlotKey(slot), slot.isMinister] as const)
      : [],
  );

  const solverSlots: WorkingSlot[] = result.slots.map((slot) => {
    const key = workingSlotKey(slot);
    const wasManual = manualKeys.has(key);
    return {
      eventId: slot.eventId,
      roleId: slot.roleId,
      slotIndex: slot.slotIndex,
      membershipId: slot.membershipId,
      isManual: wasManual,
      isMinister: wasManual ? (ministerByManualKey.get(key) ?? false) : false,
    };
  });

  const scheduleId = await prisma.$transaction(async (tx) => {
    const schedule = await tx.schedule.upsert({
      where: { organizationId_year_month: { organizationId, year, month } },
      create: {
        organizationId,
        year,
        month,
        status: 'DRAFT',
        generationStatus: result.status,
        hasPendingDraft: false,
      },
      update: {},
    });

    if (existing && shouldSavePreviousVersionBeforeOverwrite(existing.slots.length)) {
      const existingSlots = existing.slots.map(toWorkingSlot);
      const state = visibilityState(existing);

      await savePreviousVersion(tx, schedule.id, existingSlots, {
        statusAtSave: existing.status,
        generationStatus: existing.generationStatus,
        hasPublishedGaps: existing.hasPublishedGaps,
        publishedAt: existing.publishedAt,
      });

      if (shouldFreezeSnapshotOnRegenerateFromPublished(state)) {
        await freezePublishedSnapshot(tx, schedule.id, existingSlots, {
          generationStatus: existing.generationStatus,
          hasPublishedGaps: existing.hasPublishedGaps,
          publishedAt: existing.publishedAt,
        });
      }

      await tx.schedule.update({
        where: { id: schedule.id },
        data: {
          status: 'DRAFT',
          generationStatus: result.status,
          hasPendingDraft: resolveHasPendingDraftAfterRegenerate(state),
        },
      });
    } else {
      await tx.schedule.update({
        where: { id: schedule.id },
        data: {
          status: 'DRAFT',
          generationStatus: result.status,
          hasPendingDraft: false,
        },
      });
    }

    await replaceWorkingSlots(tx, schedule.id, solverSlots);
    return schedule.id;
  });

  return {
    scheduleId,
    status: result.status,
    blankCount: result.unfilledSlots.length,
  };
}

function buildEventsFromRows(
  rows: Array<{
    id: string;
    eventId: string;
    roleId: string;
    roleName: string;
    slotIndex: number;
    membershipId: string | null;
    memberName: string | null;
    isManual: boolean;
    isMinister: boolean;
    dateKey: string;
    dayOfWeek: SolverEventInput['dayOfWeek'];
  }>,
) {
  const slotViews = rows.map((slot) => ({
    id: slot.id,
    eventId: slot.eventId,
    roleId: slot.roleId,
    roleName: slot.roleName,
    slotIndex: slot.slotIndex,
    membershipId: slot.membershipId,
    memberName: slot.memberName,
    isManual: slot.isManual,
    isMinister: slot.isMinister,
  }));

  const eventsById = new Map<
    string,
    { eventId: string; date: string; dayOfWeek: SolverEventInput['dayOfWeek'] }
  >();
  for (const slot of rows) {
    if (!eventsById.has(slot.eventId)) {
      eventsById.set(slot.eventId, {
        eventId: slot.eventId,
        date: slot.dateKey,
        dayOfWeek: slot.dayOfWeek,
      });
    }
  }

  return groupSlotsByEvent([...eventsById.values()], slotViews);
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
      publishedSnapshot: { include: { slots: true } },
      previousVersion: { select: { id: true, savedAt: true } },
    },
  });

  if (!schedule) return null;

  const state = visibilityState(schedule);
  if (options.requirePublished && !isMemberScheduleVisible(state)) return null;

  const adminWorkingRows = schedule.slots.map((slot) => {
    const dateKey = slot.event.date.toISOString().slice(0, 10);
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
      dateKey,
      dayOfWeek: getDayOfWeekFromDateKey(dateKey),
    };
  });

  const memberSource = options.requirePublished ? getMemberVisibleSlotSource(state) : 'working';

  let displayRows = adminWorkingRows;

  if (memberSource === 'snapshot' && schedule.publishedSnapshot) {
    const snapshotSlots = schedule.publishedSnapshot.slots.map(toWorkingSlot);
    const lookups = await buildLookupMaps(organizationId, snapshotSlots);
    displayRows = snapshotSlots.map((slot) => {
      const event = lookups.eventById.get(slot.eventId);
      const dateKey = event?.date.toISOString().slice(0, 10) ?? '';
      return {
        id: `snapshot:${slot.eventId}:${slot.roleId}:${slot.slotIndex}`,
        eventId: slot.eventId,
        roleId: slot.roleId,
        roleName: lookups.roleNameById.get(slot.roleId) ?? 'Função',
        slotIndex: slot.slotIndex,
        membershipId: slot.membershipId,
        memberName: slot.membershipId
          ? (lookups.memberNameById.get(slot.membershipId) ?? null)
          : null,
        isManual: slot.isManual,
        isMinister: slot.isMinister,
        dateKey,
        dayOfWeek: dateKey ? getDayOfWeekFromDateKey(dateKey) : ('SUNDAY' as const),
      };
    });
  }

  const events = buildEventsFromRows(displayRows);

  const memberVisiblePublishedAt =
    schedule.hasPendingDraft && schedule.publishedSnapshot?.publishedAt
      ? schedule.publishedSnapshot.publishedAt.toISOString()
      : schedule.publishedAt
        ? schedule.publishedAt.toISOString()
        : null;

  const memberFacingGaps =
    memberSource === 'snapshot' && schedule.publishedSnapshot
      ? schedule.publishedSnapshot.hasPublishedGaps
      : schedule.hasPublishedGaps;

  return {
    scheduleId: schedule.id,
    year: schedule.year,
    month: schedule.month,
    status: schedule.status,
    generationStatus: schedule.generationStatus,
    hasPublishedGaps: options.requirePublished ? memberFacingGaps : schedule.hasPublishedGaps,
    publishedAt: options.requirePublished
      ? memberVisiblePublishedAt
      : schedule.publishedAt
        ? schedule.publishedAt.toISOString()
        : null,
    hasPendingDraft: schedule.hasPendingDraft,
    hasPreviousVersion: Boolean(schedule.previousVersion),
    hasManualSlots: schedule.slots.some((slot) => slot.isManual),
    memberVisiblePublishedAt,
    events,
    memberCounts: options.includeMemberCounts
      ? countAssignmentsByMember(
          adminWorkingRows.map((slot) => ({
            membershipId: slot.membershipId,
            memberName: slot.memberName,
            roleId: slot.roleId,
            roleName: slot.roleName,
          })),
        )
      : [],
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
  await prisma.$transaction(async (tx) => {
    const schedule = await tx.schedule.findUnique({
      where: { organizationId_year_month: { organizationId, year, month } },
      include: {
        slots: true,
        publishedSnapshot: { include: { slots: true } },
      },
    });

    if (!schedule || schedule.slots.length === 0) {
      throw new ScheduleServiceError('Gere a escala antes de publicar.');
    }

    if (schedule.hasPendingDraft && schedule.publishedSnapshot) {
      await savePreviousVersion(
        tx,
        schedule.id,
        schedule.publishedSnapshot.slots.map(toWorkingSlot),
        {
          statusAtSave: 'PUBLISHED',
          generationStatus: schedule.publishedSnapshot.generationStatus,
          hasPublishedGaps: schedule.publishedSnapshot.hasPublishedGaps,
          publishedAt: schedule.publishedSnapshot.publishedAt,
        },
      );

      await tx.schedulePublishedSnapshot.delete({ where: { id: schedule.publishedSnapshot.id } });
    }

    const hasGaps = schedule.slots.some((slot) => slot.membershipId === null);

    await tx.schedule.update({
      where: { id: schedule.id },
      data: {
        status: 'PUBLISHED',
        hasPendingDraft: false,
        publishedSnapshotId: null,
        hasPublishedGaps: hasGaps,
        publishedAt: new Date(),
      },
    });
  });
}

export async function undoLastGeneration(
  organizationId: string,
  year: number,
  month: number,
): Promise<void> {
  const schedule = await prisma.schedule.findUnique({
    where: { organizationId_year_month: { organizationId, year, month } },
    include: {
      slots: true,
      previousVersion: { include: { slots: true } },
    },
  });

  if (!schedule?.previousVersion) {
    throw new ScheduleServiceError('Não há versão anterior para desfazer.');
  }

  const restoreSlots = schedule.previousVersion.slots.map(toWorkingSlot);
  const currentSlots = schedule.slots.map(toWorkingSlot);
  const state = visibilityState(schedule);
  const hadPublishedSnapshot = Boolean(schedule.publishedSnapshotId);
  const wasPublishedLive = schedule.status === 'PUBLISHED' && !schedule.hasPendingDraft;

  await prisma.$transaction(async (tx) => {
    if (shouldFreezeSnapshotBeforeUndo(state)) {
      await freezePublishedSnapshot(tx, schedule.id, currentSlots, {
        generationStatus: schedule.generationStatus,
        hasPublishedGaps: schedule.hasPublishedGaps,
        publishedAt: schedule.publishedAt,
      });
    }

    await savePreviousVersion(tx, schedule.id, currentSlots, {
      statusAtSave: schedule.status,
      generationStatus: schedule.generationStatus,
      hasPublishedGaps: schedule.hasPublishedGaps,
      publishedAt: schedule.publishedAt,
    });

    await replaceWorkingSlots(tx, schedule.id, restoreSlots);

    await tx.schedule.update({
      where: { id: schedule.id },
      data: {
        status: 'DRAFT',
        hasPendingDraft: resolveHasPendingDraftAfterUndo({
          hadPublishedSnapshot,
          wasPublishedLive,
        }),
        generationStatus: schedule.previousVersion!.generationStatus,
        hasPublishedGaps: schedule.previousVersion!.hasPublishedGaps,
      },
    });
  });
}

export async function getAssignmentCandidatesForAdmin(
  organizationId: string,
  year: number,
  month: number,
): Promise<ScheduleAssignmentCandidate[]> {
  const events = await loadEventsForMonth(organizationId, year, month);
  const eventIds = events.map((event) => event.id);

  const memberships = await prisma.membership.findMany({
    where: { organizationId, status: 'ACTIVE' },
    include: {
      user: { select: { name: true } },
      rolePreferences: { select: { roleId: true } },
      availabilities: {
        where: { eventId: { in: eventIds } },
        select: { eventId: true },
      },
    },
    orderBy: { user: { name: 'asc' } },
  });

  return memberships.map((membership) => ({
    membershipId: membership.id,
    memberName: membership.user.name,
    availableEventIds: membership.availabilities.map((availability) => availability.eventId),
    roleIds: membership.rolePreferences.map((preference) => preference.roleId),
  }));
}

export async function setScheduleSlotAssignment(
  organizationId: string,
  scheduleSlotId: string,
  membershipId: string | null,
): Promise<void> {
  const slot = await prisma.scheduleSlot.findFirst({
    where: { id: scheduleSlotId, schedule: { organizationId } },
  });

  if (!slot) {
    throw new ScheduleServiceError('Vaga não encontrada.');
  }

  if (membershipId) {
    const membership = await prisma.membership.findFirst({
      where: { id: membershipId, organizationId, status: 'ACTIVE' },
      include: {
        rolePreferences: { where: { roleId: slot.roleId }, select: { roleId: true } },
        availabilities: { where: { eventId: slot.eventId }, select: { eventId: true } },
      },
    });

    if (!membership) {
      throw new ScheduleServiceError('Membro não encontrado.');
    }
    if (membership.rolePreferences.length === 0) {
      throw new ScheduleServiceError('Este membro não está cadastrado para esta função.');
    }
    if (membership.availabilities.length === 0) {
      throw new ScheduleServiceError('Este membro não marcou disponibilidade para este culto.');
    }
  }

  const keepMinister = Boolean(membershipId && slot.membershipId === membershipId && slot.isMinister);

  await prisma.scheduleSlot.update({
    where: { id: slot.id },
    data: {
      membershipId,
      isManual: true,
      isMinister: keepMinister,
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
