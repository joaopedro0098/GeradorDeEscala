import type {
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
 * Deterministic pre-generation coverage check: for each (event, role)
 * requirement, counts how many members are available for that event and
 * competent for that role. Manual pins reduce the remaining need and remove
 * those members from the candidate pool for that event.
 */
export function computeShortage(input: {
  requirements: SolverRequirementInput[];
  members: SolverMemberInput[];
  pinnedSlots?: SolverPinnedSlotInput[];
}): ShortageEntry[] {
  const pinnedCountByRequirement = new Map<string, number>();
  const pinnedMembershipIdsByEvent = new Map<string, Set<string>>();

  for (const pin of input.pinnedSlots ?? []) {
    if (!pin.membershipId) continue;
    const requirementKey = `${pin.eventId}::${pin.roleId}`;
    pinnedCountByRequirement.set(
      requirementKey,
      (pinnedCountByRequirement.get(requirementKey) ?? 0) + 1,
    );

    const set = pinnedMembershipIdsByEvent.get(pin.eventId) ?? new Set<string>();
    set.add(pin.membershipId);
    pinnedMembershipIdsByEvent.set(pin.eventId, set);
  }

  const shortages: ShortageEntry[] = [];

  for (const requirement of input.requirements) {
    const pinnedCount =
      pinnedCountByRequirement.get(`${requirement.eventId}::${requirement.roleId}`) ?? 0;
    const quantityNeeded = Math.max(0, requirement.quantity - pinnedCount);
    if (quantityNeeded === 0) continue;

    const pinnedIds = pinnedMembershipIdsByEvent.get(requirement.eventId);

    const availableCandidates = input.members.filter(
      (member) =>
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
