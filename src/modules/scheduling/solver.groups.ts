import { createIntervalChecker } from './solver.interval';
import type {
  SolverAssignedSlot,
  SolverEventInput,
  SolverGroupInput,
  SolverIntervalRuleInput,
  SolverMemberInput,
  SolverRequirementInput,
} from './solver.types';

export type GroupPlacementResult = {
  /** Whole-group slot assignments already decided, to be fed straight into the result. */
  pins: SolverAssignedSlot[];
  /** Per-event set of membershipIds that must be excluded from the general search (infeasible STRICT groups). */
  excludedMembershipIdsByEvent: Map<string, Set<string>>;
};

/**
 * Pre-processing step for Member Groups (runs before the general CSP
 * search). Only STRICT groups produce output here — FLEXIBLE groups are
 * handled entirely inside the search's candidate ordering (a soft
 * tie-break), never pinned or excluded.
 *
 * For every event, in event-then-group order:
 *   - If any group member is unavailable for the event, the whole group is
 *     excluded from that event (nobody in the group is auto-assigned there —
 *     spec-approved simplification: no partial group placement).
 *   - Otherwise, an exhaustive bipartite match is attempted between group
 *     members and the event's still-open (role, slotIndex) slots, honoring
 *     each member's own role competency and the interval rule (also
 *     approved simplifications: no role-stacking and no interval relaxation
 *     within a STRICT group match — it only uses "free, interval-respecting"
 *     placements, same as the search's own tier 1).
 *   - If a full match exists, it is committed as pins and reserved (removed
 *     from the pool of open slots for subsequent groups at the same event).
 *     If not, the whole group is excluded from that event instead.
 *
 * Because a membership can belong to at most one group (enforced by a
 * unique constraint), groups never compete with each other for the same
 * person, so no creation-order tie-break is needed between them.
 */
export function resolveGroupPlacements(input: {
  /** Must already be sorted chronologically (ascending by date). */
  events: SolverEventInput[];
  requirements: SolverRequirementInput[];
  members: SolverMemberInput[];
  intervalRules: SolverIntervalRuleInput[];
  groups: SolverGroupInput[];
}): GroupPlacementResult {
  const pins: SolverAssignedSlot[] = [];
  const excludedMembershipIdsByEvent = new Map<string, Set<string>>();

  const strictGroups = input.groups.filter((group) => group.mode === 'STRICT');
  if (strictGroups.length === 0) {
    return { pins, excludedMembershipIdsByEvent };
  }

  const membersById = new Map(input.members.map((member) => [member.membershipId, member]));
  const requirementsByEvent = new Map<string, SolverRequirementInput[]>();
  for (const requirement of input.requirements) {
    const list = requirementsByEvent.get(requirement.eventId) ?? [];
    list.push(requirement);
    requirementsByEvent.set(requirement.eventId, list);
  }

  const violatesInterval = createIntervalChecker(input.events, input.intervalRules);
  const historyByMember = new Map<string, Array<{ eventId: string; roleId: string }>>();

  function excludeGroup(eventId: string, group: SolverGroupInput): void {
    const set = excludedMembershipIdsByEvent.get(eventId) ?? new Set<string>();
    for (const membershipId of group.membershipIds) set.add(membershipId);
    excludedMembershipIdsByEvent.set(eventId, set);
  }

  for (const event of input.events) {
    const requirements = requirementsByEvent.get(event.id) ?? [];
    const consumedSlotKeys = new Set<string>();

    for (const group of strictGroups) {
      const allAvailable = group.membershipIds.every((membershipId) =>
        membersById.get(membershipId)?.availableEventIds.includes(event.id),
      );
      if (!allAvailable) {
        excludeGroup(event.id, group);
        continue;
      }

      const openSlots: Array<{ roleId: string; slotIndex: number }> = [];
      for (const requirement of requirements) {
        for (let slotIndex = 0; slotIndex < requirement.quantity; slotIndex += 1) {
          const key = slotKey(requirement.roleId, slotIndex);
          if (!consumedSlotKeys.has(key)) openSlots.push({ roleId: requirement.roleId, slotIndex });
        }
      }

      const matching = findGroupMatching(
        group.membershipIds,
        openSlots,
        (membershipId, slot) => {
          const member = membersById.get(membershipId);
          if (!member) return false;
          const isCompetent = member.rolePreferences.some((p) => p.roleId === slot.roleId);
          if (!isCompetent) return false;
          const history = historyByMember.get(membershipId) ?? [];
          return !violatesInterval(history, event.id, slot.roleId);
        },
      );

      if (!matching) {
        excludeGroup(event.id, group);
        continue;
      }

      for (const [membershipId, slot] of matching) {
        pins.push({
          eventId: event.id,
          roleId: slot.roleId,
          slotIndex: slot.slotIndex,
          membershipId,
          filledByPriorityOverride: false,
          filledByRoleStacking: false,
          filledByGroupPin: true,
        });

        const history = historyByMember.get(membershipId) ?? [];
        history.push({ eventId: event.id, roleId: slot.roleId });
        historyByMember.set(membershipId, history);
        consumedSlotKeys.add(slotKey(slot.roleId, slot.slotIndex));
      }
    }
  }

  return { pins, excludedMembershipIdsByEvent };
}

function slotKey(roleId: string, slotIndex: number): string {
  return `${roleId}::${slotIndex}`;
}

/**
 * Exhaustive backtracking search for one valid one-to-one assignment of
 * every member to a distinct compatible slot. Group sizes and per-event
 * open-slot counts are small in practice, so this is cheap; it returns the
 * first feasible matching found (deterministic given input order), not an
 * optimized "best preference" matching — feasibility, not optimality, is
 * all that's required to decide whether the group can be pinned.
 */
function findGroupMatching<TSlot>(
  membershipIds: string[],
  slots: TSlot[],
  isCompatible: (membershipId: string, slot: TSlot) => boolean,
): Array<[string, TSlot]> | null {
  const assignment: Array<[string, TSlot]> = [];
  const usedSlotIndexes = new Set<number>();

  function backtrack(memberIndex: number): boolean {
    if (memberIndex >= membershipIds.length) return true;
    const membershipId = membershipIds[memberIndex];
    for (let i = 0; i < slots.length; i += 1) {
      if (usedSlotIndexes.has(i)) continue;
      if (!isCompatible(membershipId, slots[i])) continue;
      usedSlotIndexes.add(i);
      assignment.push([membershipId, slots[i]]);
      if (backtrack(memberIndex + 1)) return true;
      usedSlotIndexes.delete(i);
      assignment.pop();
    }
    return false;
  }

  return backtrack(0) ? assignment : null;
}
