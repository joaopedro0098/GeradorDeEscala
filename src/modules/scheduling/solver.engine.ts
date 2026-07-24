import { createIntervalChecker } from './solver.interval';
import { compareCandidates, compareRelaxedCandidates, compareVariables } from './solver.ordering';
import { resolveGroupPlacements } from './solver.groups';
import type {
  SolverAssignedSlot,
  SolverInput,
  SolverMemberInput,
  SolverResult,
  SolverStatus,
} from './solver.types';

const DEFAULT_TIMEOUT_MS = 8000;

type Variable = {
  id: string;
  eventId: string;
  roleId: string;
  slotIndex: number;
  eventIndex: number;
};

type Candidate = {
  membershipId: string | null;
  /** True when this candidate requires violating the interval rule (4.2 scarcity fallback). */
  isOverride: boolean;
  /** True when this candidate is already serving another role at the same event (accumulation fallback). */
  isStacked: boolean;
};

/**
 * Pure CSP/backtracking solver for a scheduling period (spec section 4).
 *
 * Modeled as branch-and-bound over the whole period at once: every
 * (event, role, slotIndex) is a variable; every eligible member is a
 * candidate value, always tried best-first per the confirmed ordering
 * (exclusivity > preference > equity), with a blank ("no one assigned")
 * as the last-resort value for every variable so the search always makes
 * forward progress.
 *
 * For every variable, candidates are offered in five tiers, from least to
 * most compromising:
 *   1. A free person, respecting the interval rule.
 *   2. A person already serving another role at the same event, if that
 *      specific role pair is one they marked as safe to accumulate,
 *      respecting the interval rule (role stacking, new feature).
 *   3. (high-priority roles only) A free person, violating the interval
 *      rule — a forced repeat (4.2 scarcity fallback).
 *   4. (high-priority roles only) An accumulating person, violating the
 *      interval rule — combines both compromises.
 *   5. Blank.
 *
 * The search keeps the best (fewest blanks) complete assignment found and
 * prunes any branch that can no longer beat it — this makes the common,
 * well-staffed case resolve in effectively linear time (the first
 * best-first path already reaches zero blanks), while genuinely scarce
 * periods trigger deeper exploration, bounded by `timeoutMs` (anytime
 * behavior per 4.4).
 *
 * Member Groups run as a pre-processing step before any of the above: STRICT
 * groups are matched and pinned (or excluded) whole, per event, ahead of the
 * general search (see solver.groups.ts); FLEXIBLE groups are not pinned —
 * they only add a tie-break bonus in candidate ordering (4.3) so the search
 * naturally prefers keeping group mates together without ever forcing it.
 */
export function solveSchedule(input: SolverInput): SolverResult {
  const events = [...input.events].sort((a, b) => a.date.localeCompare(b.date));
  const eventIndexById = new Map(events.map((event, index) => [event.id, index]));
  const membersById = new Map(input.members.map((member) => [member.membershipId, member]));
  const priorityRankByRole = new Map(input.priorityRoles.map((p) => [p.roleId, p.sortOrder]));

  const compatiblePairsByMember = new Map<string, Set<string>>();
  for (const member of input.members) {
    const pairs = new Set<string>();
    for (const pair of member.compatibleRolePairs ?? []) {
      pairs.add(combinationKey(pair.roleAId, pair.roleBId));
    }
    compatiblePairsByMember.set(member.membershipId, pairs);
  }

  function canAccumulate(membershipId: string, roleA: string, roleB: string): boolean {
    return compatiblePairsByMember.get(membershipId)?.has(combinationKey(roleA, roleB)) ?? false;
  }

  // Member Groups (pre-processing step, runs before the general search):
  // STRICT groups are matched to whole-group slot bundles per event, ahead
  // of everything else — either the whole group is pinned together or the
  // whole group is excluded from that event, so no partial split ever
  // happens automatically. FLEXIBLE groups are not pinned here; they only
  // nudge candidate ordering during the normal search (see sortByFullOrder).
  const groupPlacement = resolveGroupPlacements({
    events,
    requirements: input.requirements,
    members: input.members,
    intervalRules: input.intervalRules,
    groups: input.groups ?? [],
  });
  const pinnedVariableIds = new Set(
    groupPlacement.pins.map((pin) => variableId(pin.eventId, pin.roleId, pin.slotIndex)),
  );

  const flexibleGroupByMember = new Map<string, string>();
  for (const group of input.groups ?? []) {
    if (group.mode !== 'FLEXIBLE') continue;
    for (const membershipId of group.membershipIds) {
      flexibleGroupByMember.set(membershipId, group.groupId);
    }
  }

  const variables: Variable[] = [];
  for (const requirement of input.requirements) {
    for (let slotIndex = 0; slotIndex < requirement.quantity; slotIndex += 1) {
      const id = variableId(requirement.eventId, requirement.roleId, slotIndex);
      // Slots already committed by a STRICT group match are removed from
      // the general search entirely — they are appended to the result as-is.
      if (pinnedVariableIds.has(id)) continue;
      variables.push({
        id,
        eventId: requirement.eventId,
        roleId: requirement.roleId,
        slotIndex,
        eventIndex: eventIndexById.get(requirement.eventId) ?? 0,
      });
    }
  }

  const staticDomainByVariable = new Map<string, string[]>();
  for (const variable of variables) {
    const excludedByStrictGroup =
      groupPlacement.excludedMembershipIdsByEvent.get(variable.eventId) ?? new Set<string>();
    const eligible = input.members
      .filter((member) => !excludedByStrictGroup.has(member.membershipId))
      .filter((member) => member.availableEventIds.includes(variable.eventId))
      .filter((member) => member.rolePreferences.some((p) => p.roleId === variable.roleId))
      .map((member) => member.membershipId);
    staticDomainByVariable.set(variable.id, eligible);
  }

  const orderedVariables = [...variables].sort((a, b) =>
    compareVariables(
      {
        priorityRank: priorityRankByRole.get(a.roleId) ?? null,
        domainSize: staticDomainByVariable.get(a.id)?.length ?? 0,
        eventIndex: a.eventIndex,
      },
      {
        priorityRank: priorityRankByRole.get(b.roleId) ?? null,
        domainSize: staticDomainByVariable.get(b.id)?.length ?? 0,
        eventIndex: b.eventIndex,
      },
    ),
  );

  const priorMonthCounts = new Map<string, number>();
  for (const entry of input.priorMonthAssignments ?? []) {
    priorMonthCounts.set(scopedKey(entry.membershipId, entry.roleId), entry.count);
  }

  const checkIntervalViolation = createIntervalChecker(events, input.intervalRules);

  const periodCounts = new Map<string, number>();
  const assignmentsByMember = new Map<string, Array<{ eventId: string; roleId: string }>>();
  /** eventId -> membershipId -> set of roleIds that member already occupies at that event (max 2, via accumulation). */
  const eventOccupancy = new Map<string, Map<string, Set<string>>>();
  const finalAssignment = new Map<string, string | null>();
  const overrideFlags = new Map<string, boolean>();
  const stackFlags = new Map<string, boolean>();

  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const now = input.now ?? (() => Date.now());
  const startTime = now();
  let timedOut = false;

  function isTimeUp(): boolean {
    if (timedOut) return true;
    if (now() - startTime > timeoutMs) {
      timedOut = true;
    }
    return timedOut;
  }

  function getPeriodCount(membershipId: string, roleId: string): number {
    return periodCounts.get(scopedKey(membershipId, roleId)) ?? 0;
  }

  function getPriorMonthCount(membershipId: string, roleId: string): number {
    return priorMonthCounts.get(scopedKey(membershipId, roleId)) ?? 0;
  }

  function isExclusive(member: SolverMemberInput): boolean {
    return member.rolePreferences.length === 1;
  }

  function getPreferenceSortOrder(member: SolverMemberInput, roleId: string): number {
    return (
      member.rolePreferences.find((p) => p.roleId === roleId)?.sortOrder ?? Number.MAX_SAFE_INTEGER
    );
  }

  function getOccupiedRoles(eventId: string, membershipId: string): Set<string> {
    return eventOccupancy.get(eventId)?.get(membershipId) ?? new Set();
  }

  function violatesInterval(membershipId: string, variable: Variable): boolean {
    const history = assignmentsByMember.get(membershipId) ?? [];
    return checkIntervalViolation(history, variable.eventId, variable.roleId);
  }

  /** True when a fellow FLEXIBLE-group member is already assigned any role at this event (4.3 tie-break). */
  function hasFlexibleGroupMateScheduled(membershipId: string, eventId: string): boolean {
    const groupId = flexibleGroupByMember.get(membershipId);
    if (!groupId) return false;
    const eventMap = eventOccupancy.get(eventId);
    if (!eventMap) return false;
    for (const [otherMembershipId, roles] of eventMap) {
      if (otherMembershipId === membershipId || roles.size === 0) continue;
      if (flexibleGroupByMember.get(otherMembershipId) === groupId) return true;
    }
    return false;
  }

  function sortByFullOrder(ids: string[], eventId: string, roleId: string): string[] {
    return [...ids].sort((idA, idB) => {
      const memberA = membersById.get(idA)!;
      const memberB = membersById.get(idB)!;
      return compareCandidates(
        {
          isExclusive: isExclusive(memberA),
          preferenceSortOrder: getPreferenceSortOrder(memberA, roleId),
          periodCount: getPeriodCount(idA, roleId),
          priorMonthCount: getPriorMonthCount(idA, roleId),
          hasFlexibleGroupMateScheduled: hasFlexibleGroupMateScheduled(idA, eventId),
        },
        {
          isExclusive: isExclusive(memberB),
          preferenceSortOrder: getPreferenceSortOrder(memberB, roleId),
          periodCount: getPeriodCount(idB, roleId),
          priorMonthCount: getPriorMonthCount(idB, roleId),
          hasFlexibleGroupMateScheduled: hasFlexibleGroupMateScheduled(idB, eventId),
        },
      );
    });
  }

  function sortByEquityOnly(ids: string[], roleId: string): string[] {
    return [...ids].sort((idA, idB) =>
      compareRelaxedCandidates(
        { periodCount: getPeriodCount(idA, roleId) },
        { periodCount: getPeriodCount(idB, roleId) },
      ),
    );
  }

  /** Tier 1: free person (no role at this event yet), respecting the interval rule. */
  function buildFreeCandidates(variable: Variable, excludeIds: Set<string>): string[] {
    const staticDomain = staticDomainByVariable.get(variable.id) ?? [];
    const eligible = staticDomain.filter(
      (membershipId) =>
        !excludeIds.has(membershipId) &&
        getOccupiedRoles(variable.eventId, membershipId).size === 0 &&
        !violatesInterval(membershipId, variable),
    );
    return sortByFullOrder(eligible, variable.eventId, variable.roleId);
  }

  /** Tier 3: free person, ignoring the interval rule (priority-role scarcity, 4.2). */
  function buildRelaxedFreeCandidates(variable: Variable, excludeIds: Set<string>): string[] {
    const staticDomain = staticDomainByVariable.get(variable.id) ?? [];
    const eligible = staticDomain.filter(
      (membershipId) =>
        !excludeIds.has(membershipId) && getOccupiedRoles(variable.eventId, membershipId).size === 0,
    );
    return sortByEquityOnly(eligible, variable.roleId);
  }

  /**
   * Tiers 2 and 4: a person already serving exactly one other role at this
   * event, where that role pair is marked as safe to accumulate. `respectInterval`
   * switches between tier 2 (must respect interval) and tier 4 (may violate it).
   */
  function buildStackingCandidates(
    variable: Variable,
    respectInterval: boolean,
    excludeIds: Set<string>,
  ): string[] {
    const staticDomain = staticDomainByVariable.get(variable.id) ?? [];
    const eligible = staticDomain.filter((membershipId) => {
      if (excludeIds.has(membershipId)) return false;
      const occupiedRoles = getOccupiedRoles(variable.eventId, membershipId);
      if (occupiedRoles.size !== 1) return false;
      const [occupiedRoleId] = occupiedRoles;
      if (occupiedRoleId === variable.roleId) return false;
      if (!canAccumulate(membershipId, occupiedRoleId, variable.roleId)) return false;
      if (respectInterval && violatesInterval(membershipId, variable)) return false;
      return true;
    });

    return respectInterval
      ? sortByFullOrder(eligible, variable.eventId, variable.roleId)
      : sortByEquityOnly(eligible, variable.roleId);
  }

  function buildCandidateQueue(variable: Variable): Candidate[] {
    const used = new Set<string>();
    const queue: Candidate[] = [];

    const push = (ids: string[], isOverride: boolean, isStacked: boolean) => {
      for (const membershipId of ids) {
        queue.push({ membershipId, isOverride, isStacked });
        used.add(membershipId);
      }
    };

    push(buildFreeCandidates(variable, used), false, false);
    push(buildStackingCandidates(variable, true, used), false, true);

    if (priorityRankByRole.has(variable.roleId)) {
      push(buildRelaxedFreeCandidates(variable, used), true, false);
      push(buildStackingCandidates(variable, false, used), true, true);
    }

    queue.push({ membershipId: null, isOverride: false, isStacked: false });
    return queue;
  }

  function assign(variable: Variable, candidate: Candidate): void {
    finalAssignment.set(variable.id, candidate.membershipId);
    overrideFlags.set(variable.id, candidate.isOverride);
    stackFlags.set(variable.id, candidate.isStacked);
    if (!candidate.membershipId) return;

    const key = scopedKey(candidate.membershipId, variable.roleId);
    periodCounts.set(key, (periodCounts.get(key) ?? 0) + 1);

    const history = assignmentsByMember.get(candidate.membershipId) ?? [];
    history.push({ eventId: variable.eventId, roleId: variable.roleId });
    assignmentsByMember.set(candidate.membershipId, history);

    const eventMap = eventOccupancy.get(variable.eventId) ?? new Map<string, Set<string>>();
    const roles = eventMap.get(candidate.membershipId) ?? new Set<string>();
    roles.add(variable.roleId);
    eventMap.set(candidate.membershipId, roles);
    eventOccupancy.set(variable.eventId, eventMap);
  }

  function unassign(variable: Variable, candidate: Candidate): void {
    finalAssignment.delete(variable.id);
    overrideFlags.delete(variable.id);
    stackFlags.delete(variable.id);
    if (!candidate.membershipId) return;

    const key = scopedKey(candidate.membershipId, variable.roleId);
    periodCounts.set(key, (periodCounts.get(key) ?? 1) - 1);

    const history = assignmentsByMember.get(candidate.membershipId) ?? [];
    const historyIndex = history.findIndex(
      (h) => h.eventId === variable.eventId && h.roleId === variable.roleId,
    );
    if (historyIndex !== -1) history.splice(historyIndex, 1);

    eventOccupancy.get(variable.eventId)?.get(candidate.membershipId)?.delete(variable.roleId);
  }

  let bestBlankCount = Number.POSITIVE_INFINITY;
  let bestAssignment: Map<string, string | null> | null = null;
  let bestOverrides: Map<string, boolean> | null = null;
  let bestStacks: Map<string, boolean> | null = null;

  function recordIfBest(blankCount: number): void {
    if (blankCount >= bestBlankCount) return;
    bestBlankCount = blankCount;
    bestAssignment = new Map(finalAssignment);
    bestOverrides = new Map(overrideFlags);
    bestStacks = new Map(stackFlags);
  }

  function search(index: number, blanksSoFar: number): void {
    if (bestBlankCount === 0) return;
    if (blanksSoFar >= bestBlankCount) return;
    if (isTimeUp()) return;

    if (index >= orderedVariables.length) {
      recordIfBest(blanksSoFar);
      return;
    }

    const variable = orderedVariables[index];
    const queue = buildCandidateQueue(variable);

    for (const candidate of queue) {
      if (isTimeUp()) return;
      assign(variable, candidate);
      search(index + 1, blanksSoFar + (candidate.membershipId ? 0 : 1));
      unassign(variable, candidate);
      if (bestBlankCount === 0) return;
      if (isTimeUp()) return;
    }
  }

  // Seed the shared state with STRICT group pins so the general search sees
  // them as already-occupied ground truth (equity counts, interval history,
  // and event occupancy all reflect the pinned assignments).
  for (const pin of groupPlacement.pins) {
    if (!pin.membershipId) continue;
    const key = scopedKey(pin.membershipId, pin.roleId);
    periodCounts.set(key, (periodCounts.get(key) ?? 0) + 1);

    const history = assignmentsByMember.get(pin.membershipId) ?? [];
    history.push({ eventId: pin.eventId, roleId: pin.roleId });
    assignmentsByMember.set(pin.membershipId, history);

    const eventMap = eventOccupancy.get(pin.eventId) ?? new Map<string, Set<string>>();
    const roles = eventMap.get(pin.membershipId) ?? new Set<string>();
    roles.add(pin.roleId);
    eventMap.set(pin.membershipId, roles);
    eventOccupancy.set(pin.eventId, eventMap);
  }

  search(0, 0);

  // Defensive fallback: only reachable if the timeout fires before the very
  // first depth-first pass reaches a leaf. Falls back to whatever partial
  // state the search was in, treating any never-visited variable as blank.
  if (!bestAssignment) {
    const fallbackAssignment = new Map(finalAssignment);
    const fallbackOverrides = new Map(overrideFlags);
    const fallbackStacks = new Map(stackFlags);
    for (const variable of orderedVariables) {
      if (!fallbackAssignment.has(variable.id)) {
        fallbackAssignment.set(variable.id, null);
        fallbackOverrides.set(variable.id, false);
        fallbackStacks.set(variable.id, false);
      }
    }
    bestAssignment = fallbackAssignment;
    bestOverrides = fallbackOverrides;
    bestStacks = fallbackStacks;
  }

  const resolvedAssignment: Map<string, string | null> = bestAssignment;
  const resolvedOverrides: Map<string, boolean> = bestOverrides ?? new Map();
  const resolvedStacks: Map<string, boolean> = bestStacks ?? new Map();

  const searchedSlots: SolverAssignedSlot[] = orderedVariables.map((variable) => ({
    eventId: variable.eventId,
    roleId: variable.roleId,
    slotIndex: variable.slotIndex,
    membershipId: resolvedAssignment.get(variable.id) ?? null,
    filledByPriorityOverride: resolvedOverrides.get(variable.id) ?? false,
    filledByRoleStacking: resolvedStacks.get(variable.id) ?? false,
    filledByGroupPin: false,
  }));

  const slots: SolverAssignedSlot[] = [...groupPlacement.pins, ...searchedSlots];

  const unfilledSlots = slots
    .filter((slot) => slot.membershipId === null)
    .map((slot) => ({ eventId: slot.eventId, roleId: slot.roleId, slotIndex: slot.slotIndex }));

  const status: SolverStatus =
    unfilledSlots.length === 0 ? 'COMPLETE' : timedOut ? 'INCOMPLETE_BY_TIMEOUT' : 'INCOMPLETE_BY_SHORTAGE';

  return { status, slots, unfilledSlots };
}

function scopedKey(membershipId: string, roleId: string): string {
  return `${membershipId}::${roleId}`;
}

function variableId(eventId: string, roleId: string, slotIndex: number): string {
  return `${eventId}::${roleId}::${slotIndex}`;
}

function combinationKey(roleAId: string, roleBId: string): string {
  return [roleAId, roleBId].sort().join('::');
}
