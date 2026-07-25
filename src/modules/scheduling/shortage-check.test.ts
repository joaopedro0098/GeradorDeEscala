import { describe, expect, it } from 'vitest';
import { computeShortage, hasShortage } from './shortage-check';
import type {
  SolverEventInput,
  SolverGroupInput,
  SolverMemberInput,
  SolverRequirementInput,
} from './solver.types';

function member(id: string, roleIds: string[], eventIds: string[]): SolverMemberInput {
  return {
    membershipId: id,
    availableEventIds: eventIds,
    rolePreferences: roleIds.map((roleId, index) => ({ roleId, sortOrder: index + 1 })),
  };
}

function event(id: string, date: string): SolverEventInput {
  return { id, date, dayOfWeek: 'SUNDAY' };
}

describe('computeShortage', () => {
  it('flags a requirement when fewer eligible candidates exist than the quantity needed', () => {
    const requirements: SolverRequirementInput[] = [
      { eventId: 'friday', roleId: 'drums', quantity: 1 },
      { eventId: 'friday', roleId: 'alto', quantity: 2 },
    ];
    const members: SolverMemberInput[] = [member('m1', ['alto'], ['friday'])];

    const shortages = computeShortage({ requirements, members });

    expect(shortages).toEqual([
      { eventId: 'friday', roleId: 'drums', quantityNeeded: 1, availableCandidates: 0, missing: 1 },
      { eventId: 'friday', roleId: 'alto', quantityNeeded: 2, availableCandidates: 1, missing: 1 },
    ]);
  });

  it('does not flag a requirement when enough eligible candidates exist', () => {
    const requirements: SolverRequirementInput[] = [
      { eventId: 'sunday', roleId: 'guitar', quantity: 1 },
    ];
    const members: SolverMemberInput[] = [member('m1', ['guitar'], ['sunday'])];

    expect(computeShortage({ requirements, members })).toEqual([]);
  });

  it('does not count members who are unavailable or incompetent for the role', () => {
    const requirements: SolverRequirementInput[] = [
      { eventId: 'sunday', roleId: 'guitar', quantity: 1 },
    ];
    const members: SolverMemberInput[] = [
      member('unavailable', ['guitar'], ['saturday']),
      member('wrong-role', ['drums'], ['sunday']),
    ];

    const shortages = computeShortage({ requirements, members });
    expect(shortages).toHaveLength(1);
    expect(shortages[0].availableCandidates).toBe(0);
  });
});

describe('computeShortage — STRICT member groups', () => {
  it('subtracts a feasible STRICT group match from the quantity needed', () => {
    const requirements: SolverRequirementInput[] = [
      { eventId: 'e1', roleId: 'vocal', quantity: 1 },
    ];
    const members: SolverMemberInput[] = [member('a', ['vocal'], ['e1'])];
    const groups: SolverGroupInput[] = [{ groupId: 'g1', mode: 'STRICT', membershipIds: ['a'] }];

    const shortages = computeShortage({
      requirements,
      members,
      events: [event('e1', '2026-08-02')],
      intervalRule: null,
      groups,
    });

    // "a" alone fully covers the single vocal slot via the group pin.
    expect(shortages).toEqual([]);
  });

  it('does not count members excluded by an infeasible STRICT group as available candidates', () => {
    const requirements: SolverRequirementInput[] = [
      { eventId: 'e1', roleId: 'vocal', quantity: 1 },
    ];
    const members: SolverMemberInput[] = [
      member('a', ['vocal'], ['e1']),
      member('b', ['vocal'], []), // unavailable -> whole group excluded from e1
    ];
    const groups: SolverGroupInput[] = [{ groupId: 'g1', mode: 'STRICT', membershipIds: ['a', 'b'] }];

    const shortages = computeShortage({
      requirements,
      members,
      events: [event('e1', '2026-08-02')],
      intervalRule: null,
      groups,
    });

    // "a" is excluded from e1 (their group can't be matched there), leaving 0 candidates.
    expect(shortages).toEqual([
      { eventId: 'e1', roleId: 'vocal', quantityNeeded: 1, availableCandidates: 0, missing: 1 },
    ]);
  });

  it('ignores FLEXIBLE groups entirely', () => {
    const requirements: SolverRequirementInput[] = [
      { eventId: 'e1', roleId: 'vocal', quantity: 1 },
    ];
    const members: SolverMemberInput[] = [member('a', ['vocal'], ['e1'])];
    const groups: SolverGroupInput[] = [{ groupId: 'g1', mode: 'FLEXIBLE', membershipIds: ['a'] }];

    const shortages = computeShortage({
      requirements,
      members,
      events: [event('e1', '2026-08-02')],
      intervalRule: null,
      groups,
    });

    expect(shortages).toEqual([]);
  });

  it('behaves exactly as before when no groups or events are provided', () => {
    const requirements: SolverRequirementInput[] = [
      { eventId: 'e1', roleId: 'vocal', quantity: 1 },
    ];
    const members: SolverMemberInput[] = [member('a', ['vocal'], ['e1'])];

    expect(computeShortage({ requirements, members })).toEqual([]);
  });
});

describe('computeShortage — manual pins (keep_manual)', () => {
  it('subtracts pinned manual assignments from the quantity needed', () => {
    const requirements: SolverRequirementInput[] = [
      { eventId: 'e1', roleId: 'vocal', quantity: 1 },
    ];
    const members: SolverMemberInput[] = [member('a', ['vocal'], ['e1'])];

    const shortages = computeShortage({
      requirements,
      members,
      pinnedSlots: [{ eventId: 'e1', roleId: 'vocal', slotIndex: 0, membershipId: 'a' }],
    });

    expect(shortages).toEqual([]);
  });
});

describe('hasShortage', () => {
  it('returns false for an empty list', () => {
    expect(hasShortage([])).toBe(false);
  });

  it('returns true when there is at least one entry', () => {
    expect(
      hasShortage([
        { eventId: 'e', roleId: 'r', quantityNeeded: 1, availableCandidates: 0, missing: 1 },
      ]),
    ).toBe(true);
  });
});
