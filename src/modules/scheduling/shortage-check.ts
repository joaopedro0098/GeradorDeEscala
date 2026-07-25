import { resolveGroupPlacements } from './solver.groups';
import type {
  SolverEventInput,
  SolverGroupInput,
  SolverIntervalRuleInput,
  SolverMemberInput,
  SolverPinnedSlotInput,
  SolverRequirementInput,
} from './solver.types';

export type ShortageEntry = {
  eventId: string;
  roleId: string;
  quantityNeeded: number;
  availableCandidates: number;
  missing: number;
};

/**
 * Deterministic pre-generation coverage check (spec 4.4): for each
 * (event, role) requirement, counts how many members are available for
 * that event and competent for that role, independent of interval,
 * priority, or any solver heuristic. This is a hard, certain shortage —
 * distinct from the solver's own anytime timeout (see solver.engine.ts).
 *
 * When STRICT member groups are provided, they are resolved first (same
 * pre-processing as the main solver): quantities already covered by a
 * feasible group match are subtracted from what's needed, and members of an
 * infeasible group at a given event are excluded from that event's
 * candidate count — mirroring exactly what the solver will do, so this
 * check never reports a false shortage (or a false all-clear) relative to
 * the actual run. FLEXIBLE groups never affect this check, since they never
 * force an outcome.
 */
export function computeShortage(input: {
  requirements: SolverRequirementInput[];
  members: SolverMemberInput[];
  events?: SolverEventInput[];
  intervalRule?: SolverIntervalRuleInput | null;
  groups?: SolverGroupInput[];
  pinnedSlots?: SolverPinnedSlotInput[];
}): ShortageEntry[] {
  const groups = input.groups ?? [];
  let pins: ReturnType<typeof resolveGroupPlacements>['pins'] = [];
  let excludedMembershipIdsByEvent: ReturnType<
    typeof resolveGroupPlacements
  >['excludedMembershipIdsByEvent'] = new Map();

  if (groups.length > 0 && input.events) {
    const sortedEvents = [...input.events].sort((a, b) => a.date.localeCompare(b.date));
    const placement = resolveGroupPlacements({
      events: sortedEvents,
      requirements: input.requirements,
      members: input.members,
      intervalRule: input.intervalRule ?? null,
      groups,
    });
    pins = placement.pins;
    excludedMembershipIdsByEvent = placement.excludedMembershipIdsByEvent;
  }

  const manualPinVariableIds = new Set(
    (input.pinnedSlots ?? []).map((pin) => `${pin.eventId}::${pin.roleId}::${pin.slotIndex}`),
  );
  pins = pins.filter(
    (pin) => !manualPinVariableIds.has(`${pin.eventId}::${pin.roleId}::${pin.slotIndex}`),
  );

  const pinnedCountByRequirement = new Map<string, number>();
  const pinnedMembershipIdsByEvent = new Map<string, Set<string>>();
  for (const pin of pins) {
    if (!pin.membershipId) continue;
    const requirementKey = `${pin.eventId}::${pin.roleId}`;
    pinnedCountByRequirement.set(requirementKey, (pinnedCountByRequirement.get(requirementKey) ?? 0) + 1);

    const set = pinnedMembershipIdsByEvent.get(pin.eventId) ?? new Set<string>();
    set.add(pin.membershipId);
    pinnedMembershipIdsByEvent.set(pin.eventId, set);
  }

  for (const pin of input.pinnedSlots ?? []) {
    if (!pin.membershipId) continue;
    const requirementKey = `${pin.eventId}::${pin.roleId}`;
    pinnedCountByRequirement.set(requirementKey, (pinnedCountByRequirement.get(requirementKey) ?? 0) + 1);

    const set = pinnedMembershipIdsByEvent.get(pin.eventId) ?? new Set<string>();
    set.add(pin.membershipId);
    pinnedMembershipIdsByEvent.set(pin.eventId, set);
  }

  const shortages: ShortageEntry[] = [];

  for (const requirement of input.requirements) {
    const pinnedCount = pinnedCountByRequirement.get(`${requirement.eventId}::${requirement.roleId}`) ?? 0;
    const quantityNeeded = Math.max(0, requirement.quantity - pinnedCount);
    if (quantityNeeded === 0) continue;

    const excludedIds = excludedMembershipIdsByEvent.get(requirement.eventId);
    const pinnedIds = pinnedMembershipIdsByEvent.get(requirement.eventId);

    const availableCandidates = input.members.filter(
      (member) =>
        !excludedIds?.has(member.membershipId) &&
        !pinnedIds?.has(member.membershipId) &&
        member.availableEventIds.includes(requirement.eventId) &&
        member.rolePreferences.some((preference) => preference.roleId === requirement.roleId),
    ).length;

    if (availableCandidates < quantityNeeded) {
      shortages.push({
        eventId: requirement.eventId,
        roleId: requirement.roleId,
        quantityNeeded,
        availableCandidates,
        missing: quantityNeeded - availableCandidates,
      });
    }
  }

  return shortages;
}

export function hasShortage(shortages: ShortageEntry[]): boolean {
  return shortages.length > 0;
}
