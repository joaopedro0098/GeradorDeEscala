import { describe, expect, it } from 'vitest';
import { computeShortage, hasShortage } from './shortage-check';
import type { SolverMemberInput, SolverRequirementInput } from './solver.types';

function member(id: string, roleIds: string[], eventIds: string[]): SolverMemberInput {
  return {
    membershipId: id,
    availableEventIds: eventIds,
    rolePreferences: roleIds.map((roleId, index) => ({ roleId, sortOrder: index + 1 })),
  };
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
