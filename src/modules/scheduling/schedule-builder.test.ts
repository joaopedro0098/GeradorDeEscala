import { describe, expect, it } from 'vitest';
import {
  buildManualPinnedSlots,
  buildPriorMonthAssignments,
  buildSolverGroups,
  buildSolverInput,
  expandRequirementsForEvents,
} from './schedule-builder';

describe('expandRequirementsForEvents', () => {
  it('expands day-of-week rules into per-event requirements', () => {
    const events = [
      { id: 'ev-sun', dayOfWeek: 'SUNDAY' as const },
      { id: 'ev-wed', dayOfWeek: 'WEDNESDAY' as const },
    ];
    const dayRequirements = [
      { dayOfWeek: 'SUNDAY' as const, roleId: 'role-guitar', quantity: 2 },
      { dayOfWeek: 'SUNDAY' as const, roleId: 'role-drums', quantity: 1 },
      { dayOfWeek: 'WEDNESDAY' as const, roleId: 'role-guitar', quantity: 1 },
    ];

    const requirements = expandRequirementsForEvents(events, dayRequirements);

    expect(requirements).toEqual([
      { eventId: 'ev-sun', roleId: 'role-guitar', quantity: 2 },
      { eventId: 'ev-sun', roleId: 'role-drums', quantity: 1 },
      { eventId: 'ev-wed', roleId: 'role-guitar', quantity: 1 },
    ]);
  });

  it('ignores zero-quantity rules and days with no matching event', () => {
    const events = [{ id: 'ev-sun', dayOfWeek: 'SUNDAY' as const }];
    const dayRequirements = [
      { dayOfWeek: 'SUNDAY' as const, roleId: 'role-guitar', quantity: 0 },
      { dayOfWeek: 'FRIDAY' as const, roleId: 'role-drums', quantity: 3 },
    ];

    expect(expandRequirementsForEvents(events, dayRequirements)).toEqual([]);
  });
});

describe('buildPriorMonthAssignments', () => {
  it('counts assignments grouped by member and role, skipping blanks', () => {
    const slots = [
      { membershipId: 'mem-1', roleId: 'role-guitar' },
      { membershipId: 'mem-1', roleId: 'role-guitar' },
      { membershipId: 'mem-1', roleId: 'role-vocals' },
      { membershipId: 'mem-2', roleId: 'role-drums' },
      { membershipId: null, roleId: 'role-drums' },
    ];

    const result = buildPriorMonthAssignments(slots);

    expect(result).toEqual(
      expect.arrayContaining([
        { membershipId: 'mem-1', roleId: 'role-guitar', count: 2 },
        { membershipId: 'mem-1', roleId: 'role-vocals', count: 1 },
        { membershipId: 'mem-2', roleId: 'role-drums', count: 1 },
      ]),
    );
    expect(result).toHaveLength(3);
  });

  it('returns an empty list when there are no prior assignments', () => {
    expect(buildPriorMonthAssignments([])).toEqual([]);
  });
});

describe('buildSolverGroups', () => {
  it('maps groups to the solver contract', () => {
    const groups = [
      { id: 'group-1', mode: 'STRICT' as const, membershipIds: ['mem-1', 'mem-2'] },
    ];

    expect(buildSolverGroups(groups)).toEqual([
      { groupId: 'group-1', mode: 'STRICT', membershipIds: ['mem-1', 'mem-2'] },
    ]);
  });

  it('drops groups left with fewer than 2 members', () => {
    const groups = [
      { id: 'group-1', mode: 'FLEXIBLE' as const, membershipIds: ['mem-1'] },
      { id: 'group-2', mode: 'FLEXIBLE' as const, membershipIds: [] },
      { id: 'group-3', mode: 'STRICT' as const, membershipIds: ['mem-3', 'mem-4'] },
    ];

    expect(buildSolverGroups(groups)).toEqual([
      { groupId: 'group-3', mode: 'STRICT', membershipIds: ['mem-3', 'mem-4'] },
    ]);
  });
});

describe('buildSolverInput', () => {
  it('composes a full solver input from raw loaded data', () => {
    const input = buildSolverInput({
      events: [{ id: 'ev-1', date: '2026-08-02', dayOfWeek: 'SUNDAY' }],
      dayRequirements: [{ dayOfWeek: 'SUNDAY', roleId: 'role-guitar', quantity: 1 }],
      members: [
        {
          membershipId: 'mem-1',
          availableEventIds: ['ev-1'],
          rolePreferences: [{ roleId: 'role-guitar', sortOrder: 1 }],
          compatibleRolePairs: [],
        },
      ],
      intervalRule: null,
      priorityRoles: [],
      priorMonthSlots: [{ membershipId: 'mem-1', roleId: 'role-guitar' }],
      groups: [],
      timeoutMs: 5000,
    });

    expect(input.events).toEqual([{ id: 'ev-1', date: '2026-08-02', dayOfWeek: 'SUNDAY' }]);
    expect(input.requirements).toEqual([{ eventId: 'ev-1', roleId: 'role-guitar', quantity: 1 }]);
    expect(input.members).toHaveLength(1);
    expect(input.priorMonthAssignments).toEqual([
      { membershipId: 'mem-1', roleId: 'role-guitar', count: 1 },
    ]);
    expect(input.groups).toEqual([]);
    expect(input.timeoutMs).toBe(5000);
  });
});

describe('buildManualPinnedSlots', () => {
  it('maps only isManual slots into solver pins', () => {
    const slots = [
      {
        eventId: 'e1',
        roleId: 'vocal',
        slotIndex: 0,
        membershipId: 'm1',
        isManual: true,
      },
      {
        eventId: 'e2',
        roleId: 'drums',
        slotIndex: 0,
        membershipId: 'm2',
        isManual: false,
      },
      {
        eventId: 'e3',
        roleId: 'guitar',
        slotIndex: 1,
        membershipId: null,
        isManual: true,
      },
    ];

    expect(buildManualPinnedSlots(slots)).toEqual([
      { eventId: 'e1', roleId: 'vocal', slotIndex: 0, membershipId: 'm1' },
      { eventId: 'e3', roleId: 'guitar', slotIndex: 1, membershipId: null },
    ]);
  });
});
