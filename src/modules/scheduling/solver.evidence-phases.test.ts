import { describe, expect, it } from 'vitest';
import { solveSchedule } from './solver.engine';
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

    expect(drumAssignees.filter(Boolean)).toHaveLength(2);
    expect(new Set(drumAssignees)).toEqual(new Set(['a', 'b']));
    expect(vocal).toBe('c');
    expect(result.unfilledSlots).toEqual([]);
  });
});

describe('evidence — Passo 5 via Phase 1 equity + Passo 6', () => {
  it('without reservation, loser of e1 gets e2 in Phase 1 via role-layer equity (not via held slots)', () => {
    // Same inputs that previously relied on Phase 1 reservation + Phase 2 fill.
    // Without reservation, Phase 1 assigns both days using preference → equity.
    const result = solveSchedule({
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
    });

    const e1 = slotFor(result, 'e1', 'drums')?.membershipId;
    const e2 = slotFor(result, 'e2', 'drums')?.membershipId;

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          scenario: 'sem reserva — equidade pura na Fase 1',
          setup: {
            preferences: 'A e B empatados em drums sortOrder=1',
            availability: 'ambos em e1 e e2',
            priorMonth: 'A.drums=10, B.drums=0 (implícito)',
            periodAtStart: 'ambos 0',
          },
          whyE1: 'preferência empatada; priorMonth A=10 > B=0 → B vence e1',
          whyE2: 'preferência empatada; periodCount B=1, A=0 → A vence e2',
          e1Winner: e1,
          e2Winner: e2,
          status: result.status,
        },
        null,
        2,
      ),
    );

    expect(e1).toBe('B');
    expect(e2).toBe('A');
    expect(result.status).toBe('COMPLETE');
  });

  it('Passo 6: person stays unassigned when no slot remains; generation does not hang', () => {
    const result = solveSchedule({
      events: [{ id: 'e1', date: '2026-08-02', dayOfWeek: 'SUNDAY' }],
      requirements: [{ eventId: 'e1', roleId: 'drums', quantity: 1 }],
      members: [
        member('winner', [['drums', 1]], ['e1']),
        member('leftOut', [['drums', 1]], ['e1']),
      ],
      priorityRoles: [{ roleId: 'drums', sortOrder: 1 }],
      roles: [{ id: 'drums', createdAt: '2026-01-01T00:00:00.000Z' }],
      priorMonthAssignments: [{ membershipId: 'leftOut', roleId: 'drums', count: 5 }],
    });

    const assignedIds = result.slots
      .map((slot) => slot.membershipId)
      .filter((id): id is string => Boolean(id));

    expect(slotFor(result, 'e1', 'drums')?.membershipId).toBe('winner');
    expect(assignedIds).not.toContain('leftOut');
    expect(result.status).toBe('COMPLETE');
  });
});
