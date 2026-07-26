import { describe, expect, it } from 'vitest';
import {
  applyMinisterSelection,
  buildScheduleMatrix,
  countAssignmentsByMember,
  countBlankSlotsInEvent,
  countBlankSlotsInOverview,
  datesWithBlankSlots,
  eventHasBlankSlots,
  groupSlotsByEvent,
  hasBlankSlots,
} from './schedule.logic';

function slotView(overrides: {
  id: string;
  roleId: string;
  roleName: string;
  slotIndex?: number;
  membershipId?: string | null;
  memberName?: string | null;
}) {
  return {
    id: overrides.id,
    roleId: overrides.roleId,
    roleName: overrides.roleName,
    slotIndex: overrides.slotIndex ?? 0,
    membershipId: overrides.membershipId ?? null,
    memberName: overrides.memberName ?? null,
    isManual: false,
    isMinister: false,
  };
}

describe('buildScheduleMatrix', () => {
  it('builds one column per role used in the period and aligns cells per day', () => {
    const matrix = buildScheduleMatrix([
      {
        eventId: 'ev-2',
        date: '2026-08-12',
        dayOfWeek: 'WEDNESDAY',
        slots: [slotView({ id: 's3', roleId: 'bass', roleName: 'Baixo', memberName: 'Caio' })],
      },
      {
        eventId: 'ev-1',
        date: '2026-08-02',
        dayOfWeek: 'SUNDAY',
        slots: [
          slotView({ id: 's2', roleId: 'drums', roleName: 'Bateria', slotIndex: 1 }),
          slotView({ id: 's1', roleId: 'drums', roleName: 'Bateria', slotIndex: 0 }),
        ],
      },
    ]);

    expect(matrix.columns.map((column) => column.roleName)).toEqual(['Baixo', 'Bateria']);
    expect(matrix.rows.map((row) => row.eventId)).toEqual(['ev-1', 'ev-2']);

    const sunday = matrix.rows[0];
    expect(sunday.cells.map((cell) => cell.roleId)).toEqual(['bass', 'drums']);
    expect(sunday.cells[0].slots).toEqual([]);
    expect(sunday.cells[1].slots.map((slot) => slot.id)).toEqual(['s1', 's2']);

    const wednesday = matrix.rows[1];
    expect(wednesday.cells[0].slots.map((slot) => slot.id)).toEqual(['s3']);
    expect(wednesday.cells[1].slots).toEqual([]);
  });

  it('returns empty columns and rows when there are no events', () => {
    expect(buildScheduleMatrix([])).toEqual({ columns: [], rows: [] });
  });

  it('places Voz as the first role column', () => {
    const matrix = buildScheduleMatrix([
      {
        eventId: 'ev-1',
        date: '2026-08-02',
        dayOfWeek: 'SUNDAY',
        slots: [
          slotView({ id: 's1', roleId: 'bass', roleName: 'Baixo' }),
          slotView({ id: 's2', roleId: 'voz', roleName: 'Voz' }),
          slotView({ id: 's3', roleId: 'drums', roleName: 'Bateria' }),
        ],
      },
    ]);

    expect(matrix.columns.map((column) => column.roleName)).toEqual([
      'Voz',
      'Baixo',
      'Bateria',
    ]);
  });
});

describe('groupSlotsByEvent', () => {
  it('groups slots under their event, sorted chronologically and by role', () => {
    const events = [
      { eventId: 'ev-2', date: '2026-08-09', dayOfWeek: 'SUNDAY' as const },
      { eventId: 'ev-1', date: '2026-08-02', dayOfWeek: 'SUNDAY' as const },
    ];
    const slots = [
      {
        id: 'slot-b',
        eventId: 'ev-1',
        roleId: 'role-drums',
        roleName: 'Bateria',
        slotIndex: 0,
        membershipId: 'mem-1',
        memberName: 'Ana',
        isManual: false,
        isMinister: false,
      },
      {
        id: 'slot-a',
        eventId: 'ev-1',
        roleId: 'role-guitar',
        roleName: 'Violão',
        slotIndex: 0,
        membershipId: 'mem-2',
        memberName: 'Bruno',
        isManual: false,
        isMinister: false,
      },
    ];

    const result = groupSlotsByEvent(events, slots);

    expect(result.map((event) => event.eventId)).toEqual(['ev-1', 'ev-2']);
    expect(result[0].slots.map((slot) => slot.roleName)).toEqual(['Bateria', 'Violão']);
    expect(result[1].slots).toEqual([]);
  });
});

describe('hasBlankSlots', () => {
  it('detects at least one unfilled slot', () => {
    expect(hasBlankSlots([{ membershipId: 'mem-1' }, { membershipId: null }])).toBe(true);
    expect(hasBlankSlots([{ membershipId: 'mem-1' }])).toBe(false);
    expect(hasBlankSlots([])).toBe(false);
  });
});

describe('member gap helpers (spec 4.4a)', () => {
  const eventWithGap: Parameters<typeof eventHasBlankSlots>[0] = {
    eventId: 'ev-1',
    date: '2026-08-02',
    dayOfWeek: 'SUNDAY',
    slots: [
      {
        id: 's1',
        roleId: 'role-vocal',
        roleName: 'Vocal',
        slotIndex: 0,
        membershipId: 'mem-1',
        memberName: 'Ana',
        isManual: false,
        isMinister: false,
      },
      {
        id: 's2',
        roleId: 'role-drums',
        roleName: 'Bateria',
        slotIndex: 0,
        membershipId: null,
        memberName: null,
        isManual: false,
        isMinister: false,
      },
    ],
  };

  const eventFull = {
    ...eventWithGap,
    eventId: 'ev-2',
    date: '2026-08-09',
    slots: eventWithGap.slots.map((slot) => ({
      ...slot,
      id: `${slot.id}-full`,
      membershipId: 'mem-2',
      memberName: 'Bruno',
    })),
  };

  it('counts blank slots per event and across the overview', () => {
    expect(countBlankSlotsInEvent(eventWithGap)).toBe(1);
    expect(countBlankSlotsInEvent(eventFull)).toBe(0);
    expect(countBlankSlotsInOverview([eventWithGap, eventFull])).toBe(1);
  });

  it('lists dates that still have lacunas', () => {
    expect(eventHasBlankSlots(eventWithGap)).toBe(true);
    expect(eventHasBlankSlots(eventFull)).toBe(false);
    expect(datesWithBlankSlots([eventWithGap, eventFull])).toEqual(['2026-08-02']);
  });
});

describe('countAssignmentsByMember', () => {
  it('totals assignments per member with a per-role breakdown', () => {
    const slots = [
      { membershipId: 'mem-1', memberName: 'João', roleId: 'role-guitar', roleName: 'Violão' },
      { membershipId: 'mem-1', memberName: 'João', roleId: 'role-guitar', roleName: 'Violão' },
      { membershipId: 'mem-1', memberName: 'João', roleId: 'role-vocals', roleName: 'Vocal' },
      { membershipId: 'mem-2', memberName: 'Ana', roleId: 'role-drums', roleName: 'Bateria' },
      { membershipId: null, memberName: null, roleId: 'role-drums', roleName: 'Bateria' },
    ];

    const result = countAssignmentsByMember(slots);

    expect(result).toEqual([
      {
        membershipId: 'mem-1',
        memberName: 'João',
        total: 3,
        byRole: [
          { roleId: 'role-guitar', roleName: 'Violão', count: 2 },
          { roleId: 'role-vocals', roleName: 'Vocal', count: 1 },
        ],
      },
      {
        membershipId: 'mem-2',
        memberName: 'Ana',
        total: 1,
        byRole: [{ roleId: 'role-drums', roleName: 'Bateria', count: 1 }],
      },
    ]);
  });

  it('sorts by total descending, then name ascending', () => {
    const slots = [
      { membershipId: 'mem-1', memberName: 'Zeca', roleId: 'role-guitar', roleName: 'Violão' },
      { membershipId: 'mem-2', memberName: 'Ana', roleId: 'role-guitar', roleName: 'Violão' },
      { membershipId: 'mem-3', memberName: 'Bruno', roleId: 'role-drums', roleName: 'Bateria' },
      { membershipId: 'mem-3', memberName: 'Bruno', roleId: 'role-vocals', roleName: 'Vocal' },
    ];

    const result = countAssignmentsByMember(slots);

    expect(result.map((member) => member.memberName)).toEqual(['Bruno', 'Ana', 'Zeca']);
  });
});

describe('applyMinisterSelection', () => {
  const eventSlots = [
    { id: 'slot-1', membershipId: 'mem-1', isMinister: false },
    { id: 'slot-2', membershipId: 'mem-2', isMinister: true },
    { id: 'slot-3', membershipId: null, isMinister: false },
  ];

  it('moves the minister flag to the newly selected slot, unsetting any previous one', () => {
    const result = applyMinisterSelection(eventSlots, 'slot-1');

    expect(result.find((slot) => slot.id === 'slot-1')?.isMinister).toBe(true);
    expect(result.find((slot) => slot.id === 'slot-2')?.isMinister).toBe(false);
  });

  it('toggles the minister flag off when re-selecting the current minister', () => {
    const result = applyMinisterSelection(eventSlots, 'slot-2');

    expect(result.every((slot) => !slot.isMinister)).toBe(true);
  });

  it('never marks a blank slot as minister', () => {
    const result = applyMinisterSelection(eventSlots, 'slot-3');

    expect(result.every((slot) => !slot.isMinister)).toBe(true);
  });
});
