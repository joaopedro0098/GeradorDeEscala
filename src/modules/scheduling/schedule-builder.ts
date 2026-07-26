import type { DayOfWeek } from '@/generated/prisma/client';
import type {
  SolverEventInput,
  SolverInput,
  SolverMemberInput,
  SolverPinnedSlotInput,
  SolverPriorityRoleInput,
  SolverPriorMonthAssignmentInput,
  SolverRequirementInput,
  SolverRoleCatalogInput,
} from './solver.types';

/**
 * Pure bridge between raw persisted data (already fetched from Prisma by
 * schedule.service.ts, reshaped into plain objects) and the solver's own
 * input contract. Kept free of Prisma/I-O so it stays unit-testable.
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
 * assignments cover — prior-month equity tie-break. Blank slots never count.
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
  priorityRoles: SolverPriorityRoleInput[];
  roles: SolverRoleCatalogInput[];
  priorMonthSlots: Array<{ membershipId: string | null; roleId: string }>;
  pinnedSlots?: SolverPinnedSlotInput[];
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
    priorityRoles: params.priorityRoles,
    roles: params.roles,
    priorMonthAssignments: buildPriorMonthAssignments(params.priorMonthSlots),
    pinnedSlots: params.pinnedSlots,
  };
}
