import {
  buildRoleProcessingOrder,
  compareDisputeCandidates,
  type DisputeCandidateScore,
} from './solver.ordering';
import type {
  SolverAssignedSlot,
  SolverInput,
  SolverMemberInput,
  SolverResult,
  SolverStatus,
} from './solver.types';

type SlotKey = string;

function slotKey(eventId: string, roleId: string, slotIndex: number): SlotKey {
  return `${eventId}::${roleId}::${slotIndex}`;
}

function scopedKey(membershipId: string, roleId: string): string {
  return `${membershipId}::${roleId}`;
}

type MutableSlot = {
  eventId: string;
  roleId: string;
  slotIndex: number;
  membershipId: string | null;
  filledByManualPin: boolean;
};

export type SolveScheduleDebug = {
  /** Slots filled during Phase 2 (zero-assignment fallback / Passo 5). */
  phase2Filled: Array<{ eventId: string; roleId: string; slotIndex: number; membershipId: string }>;
};

/**
 * Greedy schedule builder — preference + equity disputes, processed by role
 * across the whole month (not day-by-day CSP).
 *
 * Phase 1: for each role (PriorityRole order, then cadastro), fill every
 * event's slots for that role. Members still at zero assignments only compete
 * on their chronologically first available event; later days are reserved so
 * Phase 2 can place people who lost every dispute on that first day (Passo 5).
 * People who already have an assignment may fill later days only when no
 * zero-assignment member is waiting on that day for the same role.
 *
 * Phase 2: members who still have zero assignments try remaining blanks
 * (Passo 5). Same dispute chain among that pool.
 *
 * Passo 6: leftover blanks / people with no slot — status INCOMPLETE_BY_SHORTAGE,
 * never throws / never blocks.
 */
export function solveSchedule(
  input: SolverInput,
  debug?: { capture?: SolveScheduleDebug },
): SolverResult {
  const events = [...input.events].sort((a, b) => a.date.localeCompare(b.date));
  const membersById = new Map(input.members.map((member) => [member.membershipId, member]));

  const priorMonthCounts = new Map<string, number>();
  for (const entry of input.priorMonthAssignments ?? []) {
    priorMonthCounts.set(scopedKey(entry.membershipId, entry.roleId), entry.count);
  }

  const periodCounts = new Map<string, number>();
  const occupiedEvents = new Map<string, Set<string>>();
  const membersWithAnyAssignment = new Set<string>();

  const firstAvailableEventId = new Map<string, string>();
  for (const member of input.members) {
    const first = events.find((event) => member.availableEventIds.includes(event.id));
    if (first) firstAvailableEventId.set(member.membershipId, first.id);
  }

  const slotsByKey = new Map<SlotKey, MutableSlot>();

  for (const requirement of input.requirements) {
    for (let slotIndex = 0; slotIndex < requirement.quantity; slotIndex += 1) {
      const key = slotKey(requirement.eventId, requirement.roleId, slotIndex);
      slotsByKey.set(key, {
        eventId: requirement.eventId,
        roleId: requirement.roleId,
        slotIndex,
        membershipId: null,
        filledByManualPin: false,
      });
    }
  }

  function markAssigned(membershipId: string, eventId: string, roleId: string): void {
    const key = scopedKey(membershipId, roleId);
    periodCounts.set(key, (periodCounts.get(key) ?? 0) + 1);
    membersWithAnyAssignment.add(membershipId);

    const occupied = occupiedEvents.get(membershipId) ?? new Set<string>();
    occupied.add(eventId);
    occupiedEvents.set(membershipId, occupied);
  }

  function isOccupiedOnEvent(membershipId: string, eventId: string): boolean {
    return occupiedEvents.get(membershipId)?.has(eventId) ?? false;
  }

  function preferenceFor(member: SolverMemberInput, roleId: string): number | null {
    const preference = member.rolePreferences.find((item) => item.roleId === roleId);
    return preference ? preference.sortOrder : null;
  }

  function isAvailable(member: SolverMemberInput, eventId: string): boolean {
    return member.availableEventIds.includes(eventId);
  }

  function scoreCandidate(
    membershipId: string,
    roleId: string,
  ): DisputeCandidateScore | null {
    const member = membersById.get(membershipId);
    if (!member) return null;
    const preferenceSortOrder = preferenceFor(member, roleId);
    if (preferenceSortOrder === null) return null;
    return {
      membershipId,
      preferenceSortOrder,
      periodCount: periodCounts.get(scopedKey(membershipId, roleId)) ?? 0,
      priorMonthCount: priorMonthCounts.get(scopedKey(membershipId, roleId)) ?? 0,
    };
  }

  function pickWinner(
    candidateIds: string[],
    roleId: string,
    tieBreakKey: string,
  ): string | null {
    const scored: DisputeCandidateScore[] = [];
    for (const membershipId of candidateIds) {
      const score = scoreCandidate(membershipId, roleId);
      if (score) scored.push(score);
    }
    if (scored.length === 0) return null;
    scored.sort((a, b) => compareDisputeCandidates(a, b, tieBreakKey));
    return scored[0].membershipId;
  }

  for (const pin of input.pinnedSlots ?? []) {
    const key = slotKey(pin.eventId, pin.roleId, pin.slotIndex);
    const existing = slotsByKey.get(key) ?? {
      eventId: pin.eventId,
      roleId: pin.roleId,
      slotIndex: pin.slotIndex,
      membershipId: null,
      filledByManualPin: true,
    };
    existing.membershipId = pin.membershipId;
    existing.filledByManualPin = true;
    slotsByKey.set(key, existing);

    if (pin.membershipId) {
      markAssigned(pin.membershipId, pin.eventId, pin.roleId);
    }
  }

  const roleOrder = buildRoleProcessingOrder(input.priorityRoles, input.roles);
  const rolesInRequirements = new Set(input.requirements.map((item) => item.roleId));
  const processingRoles = roleOrder.filter((roleId) => rolesInRequirements.has(roleId));
  for (const roleId of rolesInRequirements) {
    if (!processingRoles.includes(roleId)) processingRoles.push(roleId);
  }

  function blankSlotsFor(eventId: string, roleId: string): MutableSlot[] {
    return [...slotsByKey.values()]
      .filter(
        (slot) =>
          slot.eventId === eventId &&
          slot.roleId === roleId &&
          !slot.filledByManualPin &&
          slot.membershipId === null,
      )
      .sort((a, b) => a.slotIndex - b.slotIndex);
  }

  function basicEligible(member: SolverMemberInput, roleId: string, eventId: string): boolean {
    return (
      isAvailable(member, eventId) &&
      preferenceFor(member, roleId) !== null &&
      !isOccupiedOnEvent(member.membershipId, eventId)
    );
  }

  /** Zero-assignment members available later who can still take this role on this event. */
  function zeroMembersWaitingForPhase2(roleId: string, eventId: string): boolean {
    return input.members.some((member) => {
      if (membersWithAnyAssignment.has(member.membershipId)) return false;
      if (!basicEligible(member, roleId, eventId)) return false;
      return firstAvailableEventId.get(member.membershipId) !== eventId;
    });
  }

  function phase1Pool(roleId: string, eventId: string): SolverMemberInput[] {
    const zerosWaiting = zeroMembersWaitingForPhase2(roleId, eventId);

    return input.members.filter((member) => {
      if (!basicEligible(member, roleId, eventId)) return false;

      if (membersWithAnyAssignment.has(member.membershipId)) {
        // Leave the slot for Phase 2 when a zero member still needs this later day.
        if (zerosWaiting) return false;
        return true;
      }

      // Still zero: only compete on chronologically first available event in Phase 1.
      return firstAvailableEventId.get(member.membershipId) === eventId;
    });
  }

  function candidatesFromPool(
    roleId: string,
    eventId: string,
    pool: SolverMemberInput[],
  ): string[] {
    return pool
      .filter((member) => basicEligible(member, roleId, eventId))
      .map((member) => member.membershipId);
  }

  function fillSlotsForRoleEvent(
    roleId: string,
    eventId: string,
    pool: SolverMemberInput[],
    onFill?: (slot: MutableSlot, membershipId: string) => void,
  ): void {
    const blanks = blankSlotsFor(eventId, roleId);
    if (blanks.length === 0) return;

    let remaining = candidatesFromPool(roleId, eventId, pool);

    for (const slot of blanks) {
      if (remaining.length === 0) break;

      const tieBreakKey = `${eventId}::${roleId}::${slot.slotIndex}::${remaining.slice().sort().join(',')}`;
      const winnerId =
        remaining.length === 1 ? remaining[0] : pickWinner(remaining, roleId, tieBreakKey);

      if (!winnerId) break;

      slot.membershipId = winnerId;
      markAssigned(winnerId, eventId, roleId);
      onFill?.(slot, winnerId);
      remaining = remaining.filter((id) => id !== winnerId);
    }
  }

  // —— Phase 1: by role across the whole month (Passos 0–4) ——
  for (const roleId of processingRoles) {
    for (const event of events) {
      fillSlotsForRoleEvent(roleId, event.id, phase1Pool(roleId, event.id));
    }
  }

  // —— Phase 2: Passo 5 — only members still at zero assignments ——
  function zeroAssignmentPool(): SolverMemberInput[] {
    return input.members.filter(
      (member) => !membersWithAnyAssignment.has(member.membershipId),
    );
  }

  if (debug?.capture) {
    debug.capture.phase2Filled = [];
  }

  for (const roleId of processingRoles) {
    for (const event of events) {
      const pool = zeroAssignmentPool();
      if (pool.length === 0) break;
      fillSlotsForRoleEvent(roleId, event.id, pool, (slot, membershipId) => {
        debug?.capture?.phase2Filled.push({
          eventId: slot.eventId,
          roleId: slot.roleId,
          slotIndex: slot.slotIndex,
          membershipId,
        });
      });
    }
  }

  // —— Mop-up: remaining blanks with anyone eligible (after zeros had priority) ——
  for (const roleId of processingRoles) {
    for (const event of events) {
      fillSlotsForRoleEvent(roleId, event.id, input.members);
    }
  }

  const slots: SolverAssignedSlot[] = [...slotsByKey.values()]
    .sort(
      (a, b) =>
        a.eventId.localeCompare(b.eventId) ||
        a.roleId.localeCompare(b.roleId) ||
        a.slotIndex - b.slotIndex,
    )
    .map((slot) => ({
      eventId: slot.eventId,
      roleId: slot.roleId,
      slotIndex: slot.slotIndex,
      membershipId: slot.membershipId,
      filledByManualPin: slot.filledByManualPin,
    }));

  const unfilledSlots = slots
    .filter((slot) => slot.membershipId === null)
    .map((slot) => ({
      eventId: slot.eventId,
      roleId: slot.roleId,
      slotIndex: slot.slotIndex,
    }));

  const status: SolverStatus =
    unfilledSlots.length === 0 ? 'COMPLETE' : 'INCOMPLETE_BY_SHORTAGE';

  return { status, slots, unfilledSlots };
}
