import type { DayOfWeek } from '@/generated/prisma/client';
import type {
  SolverEventInput,
  SolverGroupInput,
  SolverGroupMode,
  SolverInput,
  SolverIntervalRuleInput,
  SolverMemberInput,
  SolverPinnedSlotInput,
  SolverPriorityRoleInput,
  SolverPriorMonthAssignmentInput,
  SolverRequirementInput,
} from './solver.types';

/**
 * Pure bridge between raw persisted data (already fetched from Prisma by
 * schedule.service.ts, reshaped into plain objects) and the solver's own
 * input contract. Kept free of Prisma/I-O so it stays unit-testable like
 * the rest of the solver module.
 */

/**
 * Expands the organization's recurring (day-of-week, role) staffing rules
 * into concrete per-event requirements for the events actually happening in
 * the period being scheduled.
 */
export function expandRequirementsForEvents(
  events: Array<{ id: string; dayOfWeek: DayOfWeek }>,
  dayRequirements: Array<{ dayOfWeek: DayOfWeek; roleId: string; quantity: number }>,
): SolverRequirementInput[] {
  const requirements: SolverRequirementInput[] = [];

  for (const event of events) {
    for (const requirement of dayRequirements) {
      if (requirement.dayOfWeek !== event.dayOfWeek) continue;
      if (requirement.quantity <= 0) continue;
      requirements.push({
        eventId: event.id,
        roleId: requirement.roleId,
        quantity: requirement.quantity,
      });
    }
  }

  return requirements;
}

/**
 * Counts, per (membershipId, roleId), how many slots a previous schedule's
 * assignments cover — the "previous period" signal used as the final
 * equity tie-break (4.3). Blank slots (no membershipId) never count.
 */
export function buildPriorMonthAssignments(
  priorSlots: Array<{ membershipId: string | null; roleId: string }>,
): SolverPriorMonthAssignmentInput[] {
  const counts = new Map<string, SolverPriorMonthAssignmentInput>();

  for (const slot of priorSlots) {
    if (!slot.membershipId) continue;
    const key = `${slot.membershipId}::${slot.roleId}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { membershipId: slot.membershipId, roleId: slot.roleId, count: 1 });
    }
  }

  return [...counts.values()];
}

/**
 * Maps raw member groups into the solver's contract, defensively dropping
 * any group left with fewer than 2 members (e.g. after member removals) —
 * a group of 0 or 1 has nothing meaningful to coordinate.
 */
export function buildSolverGroups(
  groups: Array<{ id: string; mode: SolverGroupMode; membershipIds: string[] }>,
): SolverGroupInput[] {
  return groups
    .filter((group) => group.membershipIds.length >= 2)
    .map((group) => ({
      groupId: group.id,
      mode: group.mode,
      membershipIds: group.membershipIds,
    }));
}

/**
 * Maps persisted manual slots into solver pins for keep_manual regeneration.
 * Blank manual slots are pinned too — the solver must not fill them.
 */
export function buildManualPinnedSlots(
  slots: Array<{
    eventId: string;
    roleId: string;
    slotIndex: number;
    membershipId: string | null;
    isManual: boolean;
  }>,
): SolverPinnedSlotInput[] {
  return slots
    .filter((slot) => slot.isManual)
    .map((slot) => ({
      eventId: slot.eventId,
      roleId: slot.roleId,
      slotIndex: slot.slotIndex,
      membershipId: slot.membershipId,
    }));
}

export type BuildSolverInputParams = {
  events: SolverEventInput[];
  dayRequirements: Array<{ dayOfWeek: DayOfWeek; roleId: string; quantity: number }>;
  members: SolverMemberInput[];
  intervalRules: SolverIntervalRuleInput[];
  priorityRoles: SolverPriorityRoleInput[];
  priorMonthSlots: Array<{ membershipId: string | null; roleId: string }>;
  groups: Array<{ id: string; mode: SolverGroupMode; membershipIds: string[] }>;
  pinnedSlots?: SolverPinnedSlotInput[];
  timeoutMs?: number;
  now?: () => number;
};

/**
 * Composes the full solver input for a scheduling period from already
 * loaded (but not yet solver-shaped) data.
 */
export function buildSolverInput(params: BuildSolverInputParams): SolverInput {
  return {
    events: params.events,
    requirements: expandRequirementsForEvents(params.events, params.dayRequirements),
    members: params.members,
    intervalRules: params.intervalRules,
    priorityRoles: params.priorityRoles,
    priorMonthAssignments: buildPriorMonthAssignments(params.priorMonthSlots),
    groups: buildSolverGroups(params.groups),
    pinnedSlots: params.pinnedSlots,
    timeoutMs: params.timeoutMs,
    now: params.now,
  };
}
