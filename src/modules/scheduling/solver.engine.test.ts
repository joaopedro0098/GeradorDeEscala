import { describe, expect, it } from 'vitest';
import { solveSchedule } from './solver.engine';
import type {
  SolverEventInput,
  SolverInput,
  SolverIntervalRuleInput,
  SolverMemberInput,
  SolverPriorityRoleInput,
  SolverRequirementInput,
} from './solver.types';

function event(id: string, date: string): SolverEventInput {
  return { id, date, dayOfWeek: 'SUNDAY' };
}

function member(
  membershipId: string,
  roleIds: string[],
  availableEventIds: string[],
  compatibleRolePairs: Array<[string, string]> = [],
): SolverMemberInput {
  return {
    membershipId,
    availableEventIds,
    rolePreferences: roleIds.map((roleId, index) => ({ roleId, sortOrder: index + 1 })),
    compatibleRolePairs: compatibleRolePairs.map(([roleAId, roleBId]) => ({ roleAId, roleBId })),
  };
}

function slotFor(result: ReturnType<typeof solveSchedule>, eventId: string, roleId: string) {
  return result.slots.find((slot) => slot.eventId === eventId && slot.roleId === roleId);
}

/** Forces an immediate timeout on the very first check, regardless of node count. */
function immediatelyExpiredClock() {
  let calls = 0;
  return () => {
    calls += 1;
    return calls === 1 ? 0 : Number.MAX_SAFE_INTEGER;
  };
}

describe('solveSchedule — baseline behavior', () => {
  it('fills every slot and reports COMPLETE when supply covers demand', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02'), event('e2', '2026-08-09')],
      requirements: [
        { eventId: 'e1', roleId: 'vocal', quantity: 1 },
        { eventId: 'e2', roleId: 'vocal', quantity: 1 },
      ],
      members: [member('m1', ['vocal'], ['e1', 'e2']), member('m2', ['vocal'], ['e1', 'e2'])],
      intervalRules: [],
      priorityRoles: [],
    };

    const result = solveSchedule(input);

    expect(result.status).toBe('COMPLETE');
    expect(result.unfilledSlots).toHaveLength(0);
    expect(result.slots.every((slot) => slot.membershipId !== null)).toBe(true);
  });

  it('never assigns a member to an event they did not mark as available', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements: [{ eventId: 'e1', roleId: 'vocal', quantity: 1 }],
      members: [member('unavailable', ['vocal'], [])],
      intervalRules: [],
      priorityRoles: [{ roleId: 'vocal', sortOrder: 1 }],
    };

    const result = solveSchedule(input);

    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBeNull();
    expect(result.status).toBe('INCOMPLETE_BY_SHORTAGE');
  });
});

describe('solveSchedule — 4.1 interval rule', () => {
  it('blocks reassignment within the general BY_EVENT interval window', () => {
    const rule: SolverIntervalRuleInput = { roleId: null, intervalCount: 1, countMode: 'BY_EVENT' };
    const input: SolverInput = {
      events: [event('e1', '2026-08-02'), event('e2', '2026-08-05')],
      requirements: [
        { eventId: 'e1', roleId: 'drums', quantity: 1 },
        { eventId: 'e2', roleId: 'drums', quantity: 1 },
      ],
      members: [member('only-one', ['drums'], ['e1', 'e2'])],
      intervalRules: [rule],
      priorityRoles: [],
    };

    const result = solveSchedule(input);

    expect(slotFor(result, 'e1', 'drums')?.membershipId).toBe('only-one');
    expect(slotFor(result, 'e2', 'drums')?.membershipId).toBeNull();
    expect(result.status).toBe('INCOMPLETE_BY_SHORTAGE');
  });

  it('BY_DAY_OF_WEEK only counts events on the same weekday', () => {
    const wednesday = (id: string, date: string): SolverEventInput => ({
      id,
      date,
      dayOfWeek: 'WEDNESDAY',
    });
    const friday = (id: string, date: string): SolverEventInput => ({
      id,
      date,
      dayOfWeek: 'FRIDAY',
    });

    const rule: SolverIntervalRuleInput = {
      roleId: null,
      intervalCount: 1,
      countMode: 'BY_DAY_OF_WEEK',
    };

    const input: SolverInput = {
      events: [
        wednesday('wed1', '2026-08-05'),
        friday('fri1', '2026-08-07'),
        wednesday('wed2', '2026-08-12'),
      ],
      requirements: [
        { eventId: 'wed1', roleId: 'vocal', quantity: 1 },
        { eventId: 'fri1', roleId: 'vocal', quantity: 1 },
        { eventId: 'wed2', roleId: 'vocal', quantity: 1 },
      ],
      members: [member('m1', ['vocal'], ['wed1', 'fri1', 'wed2'])],
      intervalRules: [rule],
      priorityRoles: [],
    };

    const result = solveSchedule(input);

    // Same person can serve the Wednesday and the Friday in between,
    // but the interval blocks them from serving the next Wednesday.
    expect(slotFor(result, 'wed1', 'vocal')?.membershipId).toBe('m1');
    expect(slotFor(result, 'fri1', 'vocal')?.membershipId).toBe('m1');
    expect(slotFor(result, 'wed2', 'vocal')?.membershipId).toBeNull();
  });

  it('lets a role-specific rule override the general rule for that role only', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02'), event('e2', '2026-08-05')],
      requirements: [
        { eventId: 'e1', roleId: 'drums', quantity: 1 },
        { eventId: 'e2', roleId: 'drums', quantity: 1 },
        { eventId: 'e1', roleId: 'vocal', quantity: 1 },
        { eventId: 'e2', roleId: 'vocal', quantity: 1 },
      ],
      members: [
        member('a', ['drums', 'vocal'], ['e1', 'e2']),
        member('b', ['drums', 'vocal'], ['e1', 'e2']),
      ],
      intervalRules: [{ roleId: 'drums', intervalCount: 1, countMode: 'BY_EVENT' }],
      priorityRoles: [],
    };

    const result = solveSchedule(input);

    const drumsE1 = slotFor(result, 'e1', 'drums')?.membershipId;
    const drumsE2 = slotFor(result, 'e2', 'drums')?.membershipId;

    expect(drumsE1).not.toBeNull();
    expect(drumsE2).not.toBeNull();
    expect(drumsE1).not.toBe(drumsE2);
    expect(result.status).toBe('COMPLETE');
  });
});

describe('solveSchedule — 4.2 high priority (surplus scenario)', () => {
  it('gives a contested person to the priority role over the non-priority role', () => {
    const priorityRoles: SolverPriorityRoleInput[] = [{ roleId: 'leadVocal', sortOrder: 1 }];
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements: [
        { eventId: 'e1', roleId: 'leadVocal', quantity: 1 },
        { eventId: 'e1', roleId: 'guitar', quantity: 1 },
      ],
      members: [member('only-one', ['leadVocal', 'guitar'], ['e1'])],
      intervalRules: [],
      priorityRoles,
    };

    const result = solveSchedule(input);

    expect(slotFor(result, 'e1', 'leadVocal')?.membershipId).toBe('only-one');
    expect(slotFor(result, 'e1', 'guitar')?.membershipId).toBeNull();
  });

  it('when multiple priority roles compete for one multi-role person, higher priority wins first', () => {
    const priorityRoles: SolverPriorityRoleInput[] = [
      { roleId: 'leadVocal', sortOrder: 1 },
      { roleId: 'keys', sortOrder: 2 },
    ];
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements: [
        { eventId: 'e1', roleId: 'leadVocal', quantity: 1 },
        { eventId: 'e1', roleId: 'keys', quantity: 1 },
      ],
      members: [member('only-one', ['leadVocal', 'keys'], ['e1'])],
      intervalRules: [],
      priorityRoles,
    };

    const result = solveSchedule(input);

    expect(slotFor(result, 'e1', 'leadVocal')?.membershipId).toBe('only-one');
    expect(slotFor(result, 'e1', 'keys')?.membershipId).toBeNull();
  });
});

describe('solveSchedule — 4.2 high priority (scarcity: relax interval)', () => {
  it('fills a priority role by violating interval when no other candidate exists, flagging the override', () => {
    const priorityRoles: SolverPriorityRoleInput[] = [{ roleId: 'vocal', sortOrder: 1 }];
    const rule: SolverIntervalRuleInput = { roleId: null, intervalCount: 1, countMode: 'BY_EVENT' };
    const input: SolverInput = {
      events: [event('e1', '2026-08-02'), event('e2', '2026-08-05')],
      requirements: [
        { eventId: 'e1', roleId: 'vocal', quantity: 1 },
        { eventId: 'e2', roleId: 'vocal', quantity: 1 },
      ],
      members: [member('only-one', ['vocal'], ['e1', 'e2'])],
      intervalRules: [rule],
      priorityRoles,
    };

    const result = solveSchedule(input);

    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBe('only-one');
    expect(slotFor(result, 'e1', 'vocal')?.filledByPriorityOverride).toBe(false);
    expect(slotFor(result, 'e2', 'vocal')?.membershipId).toBe('only-one');
    expect(slotFor(result, 'e2', 'vocal')?.filledByPriorityOverride).toBe(true);
    expect(result.status).toBe('COMPLETE');
  });

  it('among relaxed candidates, picks whoever has participated least in the current period', () => {
    const priorityRoles: SolverPriorityRoleInput[] = [{ roleId: 'vocal', sortOrder: 1 }];
    const rule: SolverIntervalRuleInput = { roleId: null, intervalCount: 1, countMode: 'BY_EVENT' };
    const input: SolverInput = {
      events: [event('e0', '2026-08-01'), event('e1', '2026-08-02'), event('e2', '2026-08-03')],
      requirements: [
        { eventId: 'e0', roleId: 'vocal', quantity: 1 },
        { eventId: 'e1', roleId: 'vocal', quantity: 2 },
        { eventId: 'e2', roleId: 'vocal', quantity: 1 },
      ],
      // m2 is the only one available for e0, so m2 is forced to take on an
      // extra occurrence before the double-booked e1 consumes both people,
      // which boxes in e2 (interval=1 blocks both m1 and m2 via e1).
      members: [member('m1', ['vocal'], ['e1', 'e2']), member('m2', ['vocal'], ['e0', 'e1', 'e2'])],
      intervalRules: [rule],
      priorityRoles,
    };

    const result = solveSchedule(input);

    // By the time e2 is reached, m1 has 1 period occurrence (from e1) and m2
    // has 2 (from e0 and e1), so the relaxed fallback should prefer m1.
    expect(slotFor(result, 'e0', 'vocal')?.membershipId).toBe('m2');
    expect(slotFor(result, 'e2', 'vocal')?.membershipId).toBe('m1');
    expect(slotFor(result, 'e2', 'vocal')?.filledByPriorityOverride).toBe(true);
    expect(result.status).toBe('COMPLETE');
  });
});

describe('solveSchedule — 4.3 exclusivity, preference and equity', () => {
  it('gives the slot to the exclusive candidate over a multi-role candidate with the same preference rank', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements: [{ eventId: 'e1', roleId: 'drums', quantity: 1 }],
      members: [
        member('joao', ['drums', 'bass'], ['e1']),
        member('diego', ['drums'], ['e1']),
      ],
      intervalRules: [],
      priorityRoles: [],
    };

    const result = solveSchedule(input);

    expect(slotFor(result, 'e1', 'drums')?.membershipId).toBe('diego');
  });

  it('falls back to personal preference order when exclusivity does not differentiate', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements: [{ eventId: 'e1', roleId: 'bass', quantity: 1 }],
      members: [
        member('prefers-bass-first', ['bass', 'guitar'], ['e1']),
        member('prefers-bass-second', ['guitar', 'bass'], ['e1']),
      ],
      intervalRules: [],
      priorityRoles: [],
    };

    const result = solveSchedule(input);

    expect(slotFor(result, 'e1', 'bass')?.membershipId).toBe('prefers-bass-first');
  });

  it('breaks a preference tie using fewer occurrences of the role in the current period', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02'), event('e2', '2026-08-09'), event('e3', '2026-08-16')],
      requirements: [
        { eventId: 'e1', roleId: 'vocal', quantity: 1 },
        { eventId: 'e2', roleId: 'vocal', quantity: 1 },
        { eventId: 'e3', roleId: 'vocal', quantity: 1 },
      ],
      members: [member('a', ['vocal'], ['e1', 'e2', 'e3']), member('b', ['vocal'], ['e2', 'e3'])],
      intervalRules: [],
      priorityRoles: [],
    };

    const result = solveSchedule(input);

    // "a" fills e1 alone; by e2 "a" has 1 occurrence and "b" has 0, so "b" wins the tie at e2.
    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBe('a');
    expect(slotFor(result, 'e2', 'vocal')?.membershipId).toBe('b');
  });

  it('breaks a current-period tie using previous-period occupation of the role', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements: [{ eventId: 'e1', roleId: 'vocal', quantity: 1 }],
      members: [member('recently-served', ['vocal'], ['e1']), member('due-for-a-turn', ['vocal'], ['e1'])],
      intervalRules: [],
      priorityRoles: [],
      priorMonthAssignments: [
        { membershipId: 'recently-served', roleId: 'vocal', count: 3 },
        { membershipId: 'due-for-a-turn', roleId: 'vocal', count: 0 },
      ],
    };

    const result = solveSchedule(input);

    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBe('due-for-a-turn');
  });
});

describe('solveSchedule — 4.4 shortage vs timeout status', () => {
  it('reports INCOMPLETE_BY_SHORTAGE when the search proves coverage is impossible', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements: [{ eventId: 'e1', roleId: 'drums', quantity: 2 }],
      members: [member('only-one', ['drums'], ['e1'])],
      intervalRules: [],
      priorityRoles: [],
    };

    const result = solveSchedule(input);

    expect(result.status).toBe('INCOMPLETE_BY_SHORTAGE');
    expect(result.unfilledSlots).toHaveLength(1);
  });

  it('reports INCOMPLETE_BY_TIMEOUT when the search is cut short before proving anything', () => {
    const requirements: SolverRequirementInput[] = [{ eventId: 'e1', roleId: 'vocal', quantity: 1 }];
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements,
      members: [member('m1', ['vocal'], ['e1'])],
      intervalRules: [],
      priorityRoles: [],
      timeoutMs: 5,
      now: immediatelyExpiredClock(),
    };

    const result = solveSchedule(input);

    expect(result.status).toBe('INCOMPLETE_BY_TIMEOUT');
    expect(result.unfilledSlots).toHaveLength(1);
  });

  it('reports COMPLETE even under a tight timeout if a full solution was already found', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements: [{ eventId: 'e1', roleId: 'vocal', quantity: 1 }],
      members: [member('m1', ['vocal'], ['e1'])],
      intervalRules: [],
      priorityRoles: [],
      timeoutMs: 8000,
    };

    const result = solveSchedule(input);

    expect(result.status).toBe('COMPLETE');
  });
});

describe('solveSchedule — double-booking prevention', () => {
  it('never assigns the same member to two different slots of the same event without a compatible pair', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements: [
        { eventId: 'e1', roleId: 'drums', quantity: 1 },
        { eventId: 'e1', roleId: 'bass', quantity: 1 },
      ],
      members: [member('multi', ['drums', 'bass'], ['e1']), member('backup', ['bass'], ['e1'])],
      intervalRules: [],
      priorityRoles: [],
    };

    const result = solveSchedule(input);

    const drums = slotFor(result, 'e1', 'drums')?.membershipId;
    const bass = slotFor(result, 'e1', 'bass')?.membershipId;
    expect(drums).toBe('multi');
    expect(bass).toBe('backup');
    expect(drums).not.toBe(bass);
  });
});

describe('solveSchedule — role accumulation (stacking)', () => {
  it('never stacks a member onto a second role when a free person can fill it', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements: [
        { eventId: 'e1', roleId: 'drums', quantity: 1 },
        { eventId: 'e1', roleId: 'vocal', quantity: 1 },
      ],
      members: [
        member('a', ['drums', 'vocal'], ['e1'], [['drums', 'vocal']]),
        member('b', ['vocal'], ['e1']),
      ],
      intervalRules: [],
      priorityRoles: [],
    };

    const result = solveSchedule(input);

    expect(slotFor(result, 'e1', 'drums')?.membershipId).toBe('a');
    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBe('b');
    expect(slotFor(result, 'e1', 'vocal')?.filledByRoleStacking).toBe(false);
  });

  it('stacks a compatible pair onto one person as a fallback when nobody else is free', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements: [
        { eventId: 'e1', roleId: 'drums', quantity: 1 },
        { eventId: 'e1', roleId: 'vocal', quantity: 1 },
      ],
      members: [member('only-one', ['drums', 'vocal'], ['e1'], [['drums', 'vocal']])],
      intervalRules: [],
      priorityRoles: [],
    };

    const result = solveSchedule(input);

    expect(slotFor(result, 'e1', 'drums')?.membershipId).toBe('only-one');
    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBe('only-one');
    expect(slotFor(result, 'e1', 'vocal')?.filledByRoleStacking).toBe(true);
    expect(slotFor(result, 'e1', 'vocal')?.filledByPriorityOverride).toBe(false);
    expect(result.status).toBe('COMPLETE');
  });

  it('does not allow stacking for a role pair the member did not mark as compatible', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements: [
        { eventId: 'e1', roleId: 'drums', quantity: 1 },
        { eventId: 'e1', roleId: 'vocal', quantity: 1 },
      ],
      // Only marked drums+guitar as compatible, not drums+vocal.
      members: [member('only-one', ['drums', 'vocal'], ['e1'], [['drums', 'guitar']])],
      intervalRules: [],
      priorityRoles: [],
    };

    const result = solveSchedule(input);

    expect(slotFor(result, 'e1', 'drums')?.membershipId).toBe('only-one');
    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBeNull();
    expect(result.status).toBe('INCOMPLETE_BY_SHORTAGE');
  });

  it('caps accumulation at two roles per event, even with another compatible pair available', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements: [
        { eventId: 'e1', roleId: 'drums', quantity: 1 },
        { eventId: 'e1', roleId: 'vocal', quantity: 1 },
        { eventId: 'e1', roleId: 'keys', quantity: 1 },
      ],
      members: [
        member(
          'only-one',
          ['drums', 'vocal', 'keys'],
          ['e1'],
          [
            ['drums', 'vocal'],
            ['drums', 'keys'],
          ],
        ),
      ],
      intervalRules: [],
      priorityRoles: [],
    };

    const result = solveSchedule(input);

    expect(slotFor(result, 'e1', 'drums')?.membershipId).toBe('only-one');
    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBe('only-one');
    // A third role for the same person in the same event is never allowed.
    expect(slotFor(result, 'e1', 'keys')?.membershipId).toBeNull();
    expect(result.status).toBe('INCOMPLETE_BY_SHORTAGE');
  });

  it('prefers accumulation over a forced interval-violating repeat for a high-priority role', () => {
    // guitar (rank 1) is decided before vocal (rank 2) at e2, so by the time
    // vocal@e2 is resolved, "a" already occupies guitar there and can
    // legitimately stack, while "b" would only qualify by violating interval.
    const priorityRoles: SolverPriorityRoleInput[] = [
      { roleId: 'guitar', sortOrder: 1 },
      { roleId: 'vocal', sortOrder: 2 },
    ];
    const rule: SolverIntervalRuleInput = { roleId: null, intervalCount: 1, countMode: 'BY_EVENT' };
    const input: SolverInput = {
      events: [event('e1', '2026-08-02'), event('e2', '2026-08-05')],
      requirements: [
        { eventId: 'e2', roleId: 'guitar', quantity: 1 },
        { eventId: 'e1', roleId: 'vocal', quantity: 1 },
        { eventId: 'e2', roleId: 'vocal', quantity: 1 },
      ],
      members: [
        member('a', ['vocal', 'guitar'], ['e1', 'e2'], [['guitar', 'vocal']]),
        member('b', ['vocal'], ['e1', 'e2']),
      ],
      intervalRules: [rule],
      priorityRoles,
    };

    const result = solveSchedule(input);

    expect(slotFor(result, 'e2', 'guitar')?.membershipId).toBe('a');
    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBe('b');
    expect(slotFor(result, 'e2', 'vocal')?.membershipId).toBe('a');
    expect(slotFor(result, 'e2', 'vocal')?.filledByRoleStacking).toBe(true);
    expect(slotFor(result, 'e2', 'vocal')?.filledByPriorityOverride).toBe(false);
    expect(result.status).toBe('COMPLETE');
  });

  it('falls back to accumulation combined with interval relaxation as the last resort before a blank', () => {
    // keys (rank 1) is decided before vocal (rank 2). By the time vocal@e2 is
    // resolved, the only person is boxed in on both fronts: not free (already
    // holds keys@e2) and interval-blocked (served vocal@e1) — only the
    // combined stacking + relaxation tier can still fill the slot.
    const priorityRoles: SolverPriorityRoleInput[] = [
      { roleId: 'keys', sortOrder: 1 },
      { roleId: 'vocal', sortOrder: 2 },
    ];
    const rule: SolverIntervalRuleInput = { roleId: null, intervalCount: 1, countMode: 'BY_EVENT' };
    const input: SolverInput = {
      events: [event('e1', '2026-08-02'), event('e2', '2026-08-05')],
      requirements: [
        { eventId: 'e2', roleId: 'keys', quantity: 1 },
        { eventId: 'e1', roleId: 'vocal', quantity: 1 },
        { eventId: 'e2', roleId: 'vocal', quantity: 1 },
      ],
      members: [member('only-one', ['vocal', 'keys'], ['e1', 'e2'], [['keys', 'vocal']])],
      intervalRules: [rule],
      priorityRoles,
    };

    const result = solveSchedule(input);

    expect(slotFor(result, 'e2', 'keys')?.membershipId).toBe('only-one');
    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBe('only-one');
    expect(slotFor(result, 'e2', 'vocal')?.membershipId).toBe('only-one');
    expect(slotFor(result, 'e2', 'vocal')?.filledByRoleStacking).toBe(true);
    expect(slotFor(result, 'e2', 'vocal')?.filledByPriorityOverride).toBe(true);
    expect(result.status).toBe('COMPLETE');
  });
});

describe('solveSchedule — member groups (FLEXIBLE)', () => {
  it('prefers keeping FLEXIBLE group mates together when candidates are otherwise tied', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements: [
        { eventId: 'e1', roleId: 'drums', quantity: 1 },
        { eventId: 'e1', roleId: 'vocal', quantity: 1 },
      ],
      members: [
        member('a', ['drums'], ['e1']),
        member('b', ['vocal'], ['e1']),
        member('c', ['vocal'], ['e1']),
      ],
      intervalRules: [],
      priorityRoles: [],
      groups: [{ groupId: 'g1', mode: 'FLEXIBLE', membershipIds: ['a', 'b'] }],
    };

    const result = solveSchedule(input);

    // Drums has only one eligible candidate (MRV resolves it first). By the
    // time vocal is resolved, "b" and "c" are tied on every 4.3 criterion,
    // so the flexible-group tie-break picks "b" (a's group mate).
    expect(slotFor(result, 'e1', 'drums')?.membershipId).toBe('a');
    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBe('b');
  });

  it('never blocks or excludes a FLEXIBLE group member when their group mate is unavailable', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements: [{ eventId: 'e1', roleId: 'vocal', quantity: 1 }],
      members: [member('a', ['vocal'], ['e1']), member('b', ['vocal'], [])],
      intervalRules: [],
      priorityRoles: [],
      groups: [{ groupId: 'g1', mode: 'FLEXIBLE', membershipIds: ['a', 'b'] }],
    };

    const result = solveSchedule(input);

    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBe('a');
    expect(result.status).toBe('COMPLETE');
  });

  it('still respects exclusivity and preference over flexible group affinity', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements: [{ eventId: 'e1', roleId: 'vocal', quantity: 1 }],
      members: [
        member('exclusive-no-group', ['vocal'], ['e1']),
        member('multi-role-with-group', ['vocal', 'drums'], ['e1']),
        member('group-mate', ['drums'], ['e1']),
      ],
      intervalRules: [],
      priorityRoles: [],
      groups: [{ groupId: 'g1', mode: 'FLEXIBLE', membershipIds: ['multi-role-with-group', 'group-mate'] }],
    };

    const result = solveSchedule(input);

    // "multi-role-with-group" has no group mate scheduled yet at this point
    // (drums isn't required here), so the affinity bonus doesn't even apply —
    // but even if it did, exclusivity always wins first.
    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBe('exclusive-no-group');
  });
});

describe('solveSchedule — member groups (STRICT)', () => {
  it('pins the entire group together via filledByGroupPin when a feasible matching exists', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements: [
        { eventId: 'e1', roleId: 'drums', quantity: 1 },
        { eventId: 'e1', roleId: 'vocal', quantity: 1 },
      ],
      members: [member('a', ['drums'], ['e1']), member('b', ['vocal'], ['e1'])],
      intervalRules: [],
      priorityRoles: [],
      groups: [{ groupId: 'g1', mode: 'STRICT', membershipIds: ['a', 'b'] }],
    };

    const result = solveSchedule(input);

    expect(slotFor(result, 'e1', 'drums')?.membershipId).toBe('a');
    expect(slotFor(result, 'e1', 'drums')?.filledByGroupPin).toBe(true);
    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBe('b');
    expect(slotFor(result, 'e1', 'vocal')?.filledByGroupPin).toBe(true);
    expect(result.status).toBe('COMPLETE');
  });

  it('excludes the whole group from an event (letting a non-group member fill in) when the group is infeasible there', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements: [{ eventId: 'e1', roleId: 'vocal', quantity: 1 }],
      members: [
        member('a', ['vocal'], ['e1']),
        member('b', ['vocal'], []), // unavailable -> whole group excluded from e1
        member('backup', ['vocal'], ['e1']),
      ],
      intervalRules: [],
      priorityRoles: [],
      groups: [{ groupId: 'g1', mode: 'STRICT', membershipIds: ['a', 'b'] }],
    };

    const result = solveSchedule(input);

    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBe('backup');
    expect(result.status).toBe('COMPLETE');
  });

  it('leaves the slot blank when a STRICT group is infeasible and no one outside the group is available', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements: [{ eventId: 'e1', roleId: 'vocal', quantity: 1 }],
      members: [member('a', ['vocal'], ['e1']), member('b', ['vocal'], [])],
      intervalRules: [],
      priorityRoles: [],
      groups: [{ groupId: 'g1', mode: 'STRICT', membershipIds: ['a', 'b'] }],
    };

    const result = solveSchedule(input);

    // "a" alone could have filled this slot, but the group's all-or-nothing
    // rule takes precedence: the slot is left blank rather than splitting the group.
    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBeNull();
    expect(result.status).toBe('INCOMPLETE_BY_SHORTAGE');
  });

  it('feeds STRICT group pins into equity and interval history for later events in the search', () => {
    const rule: SolverIntervalRuleInput = { roleId: null, intervalCount: 1, countMode: 'BY_EVENT' };
    const input: SolverInput = {
      events: [event('e1', '2026-08-02'), event('e2', '2026-08-05')],
      requirements: [
        { eventId: 'e1', roleId: 'vocal', quantity: 1 },
        { eventId: 'e2', roleId: 'vocal', quantity: 1 },
      ],
      members: [member('a', ['vocal'], ['e1', 'e2']), member('b', ['vocal'], ['e2'])],
      intervalRules: [rule],
      priorityRoles: [],
      groups: [{ groupId: 'g1', mode: 'STRICT', membershipIds: ['a'] }],
    };

    const result = solveSchedule(input);

    // "a" is pinned at e1 by their group; the interval rule then blocks "a"
    // from e2 in the general search (seeded from the pin's history), so "b" fills it.
    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBe('a');
    expect(slotFor(result, 'e1', 'vocal')?.filledByGroupPin).toBe(true);
    expect(slotFor(result, 'e2', 'vocal')?.membershipId).toBe('b');
    expect(result.status).toBe('COMPLETE');
  });

  it('never stacks two roles onto one STRICT group member even with a compatible pair configured', () => {
    const input: SolverInput = {
      events: [event('e1', '2026-08-02')],
      requirements: [
        { eventId: 'e1', roleId: 'drums', quantity: 1 },
        { eventId: 'e1', roleId: 'vocal', quantity: 1 },
      ],
      // "a" alone could stack drums+vocal, but as a 2-person STRICT group
      // with "b" (vocal-only), the matcher must give vocal to "b" instead.
      members: [
        member('a', ['drums', 'vocal'], ['e1'], [['drums', 'vocal']]),
        member('b', ['vocal'], ['e1']),
      ],
      intervalRules: [],
      priorityRoles: [],
      groups: [{ groupId: 'g1', mode: 'STRICT', membershipIds: ['a', 'b'] }],
    };

    const result = solveSchedule(input);

    expect(slotFor(result, 'e1', 'drums')?.membershipId).toBe('a');
    expect(slotFor(result, 'e1', 'vocal')?.membershipId).toBe('b');
    expect(slotFor(result, 'e1', 'vocal')?.filledByRoleStacking).toBe(false);
    expect(slotFor(result, 'e1', 'vocal')?.filledByGroupPin).toBe(true);
  });
});
