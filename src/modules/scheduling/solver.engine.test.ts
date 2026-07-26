import { describe, expect, it } from 'vitest';
import { solveSchedule } from './solver.engine';
import type { SolverInput, SolverMemberInput, SolverResult } from './solver.types';

function member(
  id: string,
  preferences: Array<[string, number]>,
  eventIds: string[],
): SolverMemberInput {
  return {
    membershipId: id,
    availableEventIds: eventIds,
    rolePreferences: preferences.map(([roleId, sortOrder]) => ({ roleId, sortOrder })),
  };
}

function baseInput(overrides: Partial<SolverInput> = {}): SolverInput {
  return {
    events: [{ id: 'e1', date: '2026-08-02', dayOfWeek: 'SUNDAY' }],
    requirements: [{ eventId: 'e1', roleId: 'drums', quantity: 1 }],
    members: [member('m1', [['drums', 1]], ['e1'])],
    priorityRoles: [{ roleId: 'drums', sortOrder: 1 }],
    roles: [{ id: 'drums', createdAt: '2026-01-01T00:00:00.000Z' }],
    ...overrides,
  };
}

function slotFor(result: SolverResult, eventId: string, roleId: string, slotIndex = 0) {
  return result.slots.find(
    (slot) =>
      slot.eventId === eventId && slot.roleId === roleId && slot.slotIndex === slotIndex,
  );
}

describe('solveSchedule — greedy dispute rules', () => {
  it('assigns directly when there is no dispute', () => {
    const result = solveSchedule(baseInput());
    expect(result.status).toBe('COMPLETE');
    expect(slotFor(result, 'e1', 'drums')?.membershipId).toBe('m1');
  });

  it('prefers the candidate with better preference for the disputed role', () => {
    const result = solveSchedule(
      baseInput({
        members: [
          member('a', [['drums', 2]], ['e1']),
          member('b', [['drums', 1]], ['e1']),
        ],
      }),
    );

    expect(slotFor(result, 'e1', 'drums')?.membershipId).toBe('b');
  });

  it('breaks preference ties with current-month equity across the role layer', () => {
    const result = solveSchedule(
      baseInput({
        events: [
          { id: 'e1', date: '2026-08-02', dayOfWeek: 'SUNDAY' },
          { id: 'e2', date: '2026-08-09', dayOfWeek: 'SUNDAY' },
        ],
        requirements: [
          { eventId: 'e1', roleId: 'drums', quantity: 1 },
          { eventId: 'e2', roleId: 'drums', quantity: 1 },
        ],
        members: [
          member('a', [['drums', 1]], ['e1', 'e2']),
          member('b', [['drums', 1]], ['e1', 'e2']),
        ],
        priorMonthAssignments: [{ membershipId: 'a', roleId: 'drums', count: 10 }],
      }),
    );

    expect(slotFor(result, 'e1', 'drums')?.membershipId).toBe('b');
    expect(slotFor(result, 'e2', 'drums')?.membershipId).toBe('a');
  });

  it('fills quantity>1 by successive disputes; leftover tries later roles', () => {
    const result = solveSchedule(
      baseInput({
        requirements: [
          { eventId: 'e1', roleId: 'drums', quantity: 2 },
          { eventId: 'e1', roleId: 'vocal', quantity: 1 },
        ],
        members: [
          member('a', [['drums', 1], ['vocal', 2]], ['e1']),
          member('b', [['drums', 1], ['vocal', 2]], ['e1']),
          member('c', [['drums', 1], ['vocal', 1]], ['e1']),
        ],
        priorityRoles: [
          { roleId: 'drums', sortOrder: 1 },
          { roleId: 'vocal', sortOrder: 2 },
        ],
        roles: [
          { id: 'drums', createdAt: '2026-01-01T00:00:00.000Z' },
          { id: 'vocal', createdAt: '2026-01-02T00:00:00.000Z' },
        ],
        priorMonthAssignments: [
          { membershipId: 'a', roleId: 'drums', count: 0 },
          { membershipId: 'b', roleId: 'drums', count: 1 },
          { membershipId: 'c', roleId: 'drums', count: 2 },
        ],
      }),
    );

    const drums0 = slotFor(result, 'e1', 'drums', 0)?.membershipId;
    const drums1 = slotFor(result, 'e1', 'drums', 1)?.membershipId;
    const vocal = slotFor(result, 'e1', 'vocal')?.membershipId;

    expect(new Set([drums0, drums1])).toEqual(new Set(['a', 'b']));
    expect(vocal).toBe('c');
    expect(result.status).toBe('COMPLETE');
  });

  it('processes higher-priority roles before lower ones across the month', () => {
    const result = solveSchedule(
      baseInput({
        events: [
          { id: 'e1', date: '2026-08-02', dayOfWeek: 'SUNDAY' },
          { id: 'e2', date: '2026-08-09', dayOfWeek: 'SUNDAY' },
        ],
        requirements: [
          { eventId: 'e1', roleId: 'drums', quantity: 1 },
          { eventId: 'e1', roleId: 'vocal', quantity: 1 },
          { eventId: 'e2', roleId: 'drums', quantity: 1 },
          { eventId: 'e2', roleId: 'vocal', quantity: 1 },
        ],
        members: [
          member('a', [['vocal', 1], ['drums', 2]], ['e1']),
          member('b', [['vocal', 1], ['drums', 2]], ['e2']),
        ],
        priorityRoles: [
          { roleId: 'drums', sortOrder: 1 },
          { roleId: 'vocal', sortOrder: 2 },
        ],
        roles: [
          { id: 'drums', createdAt: '2026-01-01T00:00:00.000Z' },
          { id: 'vocal', createdAt: '2026-01-02T00:00:00.000Z' },
        ],
      }),
    );

    expect(slotFor(result, 'e1', 'drums')?.membershipId).toBe('a');
    expect(slotFor(result, 'e2', 'drums')?.membershipId).toBe('b');
    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBeNull();
    expect(slotFor(result, 'e2', 'vocal')?.membershipId).toBeNull();
  });

  it('leaves blanks without blocking when nobody is available', () => {
    const result = solveSchedule(
      baseInput({
        members: [member('m1', [['drums', 1]], [])],
      }),
    );

    expect(result.status).toBe('INCOMPLETE_BY_SHORTAGE');
    expect(slotFor(result, 'e1', 'drums')?.membershipId).toBeNull();
    expect(result.unfilledSlots).toHaveLength(1);
  });

  it('keeps manual pins fixed and fills the rest', () => {
    const result = solveSchedule(
      baseInput({
        requirements: [
          { eventId: 'e1', roleId: 'drums', quantity: 1 },
          { eventId: 'e1', roleId: 'vocal', quantity: 1 },
        ],
        members: [
          member('a', [['drums', 1], ['vocal', 1]], ['e1']),
          member('b', [['vocal', 1]], ['e1']),
        ],
        priorityRoles: [
          { roleId: 'drums', sortOrder: 1 },
          { roleId: 'vocal', sortOrder: 2 },
        ],
        roles: [
          { id: 'drums', createdAt: '2026-01-01T00:00:00.000Z' },
          { id: 'vocal', createdAt: '2026-01-02T00:00:00.000Z' },
        ],
        pinnedSlots: [{ eventId: 'e1', roleId: 'drums', slotIndex: 0, membershipId: 'a' }],
      }),
    );

    expect(slotFor(result, 'e1', 'drums')?.membershipId).toBe('a');
    expect(slotFor(result, 'e1', 'drums')?.filledByManualPin).toBe(true);
    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBe('b');
    expect(slotFor(result, 'e1', 'vocal')?.filledByManualPin).toBe(false);
  });

  it('is deterministic for identical inputs', () => {
    const input = baseInput({
      members: [
        member('a', [['drums', 1]], ['e1']),
        member('b', [['drums', 1]], ['e1']),
      ],
    });

    expect(solveSchedule(input)).toEqual(solveSchedule(input));
  });

  it('does not assign the same person to two roles on the same event', () => {
    const result = solveSchedule(
      baseInput({
        requirements: [
          { eventId: 'e1', roleId: 'drums', quantity: 1 },
          { eventId: 'e1', roleId: 'vocal', quantity: 1 },
        ],
        members: [member('a', [['drums', 1], ['vocal', 1]], ['e1'])],
        priorityRoles: [
          { roleId: 'drums', sortOrder: 1 },
          { roleId: 'vocal', sortOrder: 2 },
        ],
        roles: [
          { id: 'drums', createdAt: '2026-01-01T00:00:00.000Z' },
          { id: 'vocal', createdAt: '2026-01-02T00:00:00.000Z' },
        ],
      }),
    );

    expect(slotFor(result, 'e1', 'drums')?.membershipId).toBe('a');
    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBeNull();
  });

  it('assigns members only on days they marked available', () => {
    const result = solveSchedule(
      baseInput({
        events: [
          { id: 'e1', date: '2026-08-02', dayOfWeek: 'SUNDAY' },
          { id: 'e2', date: '2026-08-09', dayOfWeek: 'SUNDAY' },
        ],
        requirements: [
          { eventId: 'e1', roleId: 'drums', quantity: 1 },
          { eventId: 'e2', roleId: 'drums', quantity: 1 },
        ],
        members: [
          member('busy', [['drums', 1]], ['e1']),
          member('later', [['drums', 1]], ['e2']),
        ],
      }),
    );

    expect(slotFor(result, 'e1', 'drums')?.membershipId).toBe('busy');
    expect(slotFor(result, 'e2', 'drums')?.membershipId).toBe('later');
    expect(result.status).toBe('COMPLETE');
  });
});
