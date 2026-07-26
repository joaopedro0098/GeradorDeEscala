import { describe, expect, it } from 'vitest';
import { solveSchedule } from './solver.engine';

describe('current-month equity dispute (evidence)', () => {
  it('B wins when preference ties and A already has more plays this month', () => {
    const result = solveSchedule({
      events: [
        { id: 'p1', date: '2026-08-02', dayOfWeek: 'SUNDAY' },
        { id: 'p2', date: '2026-08-09', dayOfWeek: 'SUNDAY' },
        { id: 'p3', date: '2026-08-16', dayOfWeek: 'SUNDAY' },
        { id: 'p4', date: '2026-08-23', dayOfWeek: 'SUNDAY' },
        { id: 'e5', date: '2026-08-30', dayOfWeek: 'SUNDAY' },
      ],
      requirements: [
        { eventId: 'p1', roleId: 'drums', quantity: 1 },
        { eventId: 'p2', roleId: 'drums', quantity: 1 },
        { eventId: 'p3', roleId: 'drums', quantity: 1 },
        { eventId: 'p4', roleId: 'drums', quantity: 1 },
        { eventId: 'e5', roleId: 'drums', quantity: 1 },
      ],
      members: [
        {
          membershipId: 'A',
          availableEventIds: ['e5'],
          rolePreferences: [{ roleId: 'drums', sortOrder: 1 }],
        },
        {
          membershipId: 'B',
          availableEventIds: ['e5'],
          rolePreferences: [{ roleId: 'drums', sortOrder: 1 }],
        },
      ],
      priorityRoles: [{ roleId: 'drums', sortOrder: 1 }],
      roles: [{ id: 'drums', createdAt: '2026-01-01T00:00:00.000Z' }],
      // Seed current-month counts: A=3, B=1 before the e5 dispute.
      pinnedSlots: [
        { eventId: 'p1', roleId: 'drums', slotIndex: 0, membershipId: 'A' },
        { eventId: 'p2', roleId: 'drums', slotIndex: 0, membershipId: 'A' },
        { eventId: 'p3', roleId: 'drums', slotIndex: 0, membershipId: 'A' },
        { eventId: 'p4', roleId: 'drums', slotIndex: 0, membershipId: 'B' },
      ],
    });

    const e5 = result.slots.find(
      (slot) => slot.eventId === 'e5' && slot.roleId === 'drums' && slot.slotIndex === 0,
    );

    expect(e5?.membershipId).toBe('B');
  });
});
