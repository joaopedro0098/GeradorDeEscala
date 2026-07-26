import { describe, expect, it } from 'vitest';
import { solveSchedule, type SolveScheduleDebug } from './solver.engine';
import type { SolverMemberInput, SolverResult } from './solver.types';

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

function slotFor(result: SolverResult, eventId: string, roleId: string, slotIndex = 0) {
  return result.slots.find(
    (slot) =>
      slot.eventId === eventId && slot.roleId === roleId && slot.slotIndex === slotIndex,
  );
}

describe('evidence — quantity > 1 + Passo 4', () => {
  it('fills exactly 2 of 3 disputants for drums; leftover gets next preference same day', () => {
    const result = solveSchedule({
      events: [{ id: 'e1', date: '2026-08-02', dayOfWeek: 'SUNDAY' }],
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
    });

    const drums0 = slotFor(result, 'e1', 'drums', 0)?.membershipId;
    const drums1 = slotFor(result, 'e1', 'drums', 1)?.membershipId;
    const vocal = slotFor(result, 'e1', 'vocal')?.membershipId;
    const drumAssignees = [drums0, drums1];

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          scenario: 'qty=2 drums, 3 candidatos; sobra → vocal (Passo 4)',
          drumsSlot0: drums0,
          drumsSlot1: drums1,
          vocalSlot0: vocal,
          exactlyTwoDrums: drumAssignees.filter(Boolean).length === 2,
          leftoverIsC: vocal === 'c',
          status: result.status,
        },
        null,
        2,
      ),
    );

    expect(drumAssignees.filter(Boolean)).toHaveLength(2);
    expect(new Set(drumAssignees)).toEqual(new Set(['a', 'b']));
    expect(vocal).toBe('c');
    expect(result.unfilledSlots).toEqual([]);
  });
});

describe('evidence — Phase 2 Passo 5 + Passo 6', () => {
  it('Phase 2 reallocates a zero member onto another available day', () => {
    const capture: SolveScheduleDebug = { phase2Filled: [] };

    // A and B tied on drums pref. A has worse prior-month equity → B wins e1.
    // A stays at zero after e1; e2 is reserved for Phase 2 (Passo 5).
    const result = solveSchedule(
      {
        events: [
          { id: 'e1', date: '2026-08-02', dayOfWeek: 'SUNDAY' },
          { id: 'e2', date: '2026-08-09', dayOfWeek: 'SUNDAY' },
        ],
        requirements: [
          { eventId: 'e1', roleId: 'drums', quantity: 1 },
          { eventId: 'e2', roleId: 'drums', quantity: 1 },
        ],
        members: [
          member('A', [['drums', 1]], ['e1', 'e2']),
          member('B', [['drums', 1]], ['e1', 'e2']),
        ],
        priorityRoles: [{ roleId: 'drums', sortOrder: 1 }],
        roles: [{ id: 'drums', createdAt: '2026-01-01T00:00:00.000Z' }],
        priorMonthAssignments: [{ membershipId: 'A', roleId: 'drums', count: 10 }],
      },
      { capture },
    );

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          scenario: 'A perde e1; Fase 2 realoca A em e2 (Passo 5)',
          e1: slotFor(result, 'e1', 'drums')?.membershipId,
          e2: slotFor(result, 'e2', 'drums')?.membershipId,
          phase2Filled: capture.phase2Filled,
          status: result.status,
        },
        null,
        2,
      ),
    );

    expect(slotFor(result, 'e1', 'drums')?.membershipId).toBe('B');
    expect(slotFor(result, 'e2', 'drums')?.membershipId).toBe('A');
    expect(capture.phase2Filled).toEqual([
      { eventId: 'e2', roleId: 'drums', slotIndex: 0, membershipId: 'A' },
    ]);
    expect(result.status).toBe('COMPLETE');
  });

  it('Passo 6: person stays unassigned when no slot remains; generation does not hang', () => {
    const capture: SolveScheduleDebug = { phase2Filled: [] };

    const result = solveSchedule(
      {
        events: [{ id: 'e1', date: '2026-08-02', dayOfWeek: 'SUNDAY' }],
        requirements: [{ eventId: 'e1', roleId: 'drums', quantity: 1 }],
        members: [
          member('winner', [['drums', 1]], ['e1']),
          member('leftOut', [['drums', 1]], ['e1']),
          // No other day / no other role for leftOut after losing the only slot.
        ],
        priorityRoles: [{ roleId: 'drums', sortOrder: 1 }],
        roles: [{ id: 'drums', createdAt: '2026-01-01T00:00:00.000Z' }],
        priorMonthAssignments: [{ membershipId: 'leftOut', roleId: 'drums', count: 5 }],
      },
      { capture },
    );

    const assignedIds = result.slots
      .map((slot) => slot.membershipId)
      .filter((id): id is string => Boolean(id));

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          scenario: 'Passo 6 — leftOut sem vaga; processo não trava',
          winner: slotFor(result, 'e1', 'drums')?.membershipId,
          assignedIds,
          leftOutAssigned: assignedIds.includes('leftOut'),
          phase2Filled: capture.phase2Filled,
          status: result.status,
          unfilledSlots: result.unfilledSlots,
        },
        null,
        2,
      ),
    );

    expect(slotFor(result, 'e1', 'drums')?.membershipId).toBe('winner');
    expect(assignedIds).not.toContain('leftOut');
    expect(capture.phase2Filled).toEqual([]);
    expect(result.status).toBe('COMPLETE'); // unique slot filled; person gap is OK
  });
});
