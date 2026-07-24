import { describe, expect, it } from 'vitest';
import {
  DayOfWeek,
  IntervalCountMode,
  MembershipStatus,
  NotificationType,
  PlanTier,
  ScheduleGenerationStatus,
  ScheduleStatus,
} from '@/generated/prisma/client';

describe('Prisma schema enums', () => {
  it('exports membership status values used by the auth flow', () => {
    expect(MembershipStatus.PENDING).toBe('PENDING');
    expect(MembershipStatus.ACTIVE).toBe('ACTIVE');
    expect(MembershipStatus.REJECTED).toBe('REJECTED');
  });

  it('exports scheduling enums for solver and publication states', () => {
    expect(ScheduleStatus.DRAFT).toBe('DRAFT');
    expect(ScheduleStatus.PUBLISHED).toBe('PUBLISHED');
    expect(ScheduleGenerationStatus.COMPLETE).toBe('COMPLETE');
    expect(ScheduleGenerationStatus.INCOMPLETE_BY_SHORTAGE).toBe('INCOMPLETE_BY_SHORTAGE');
    expect(ScheduleGenerationStatus.INCOMPLETE_BY_TIMEOUT).toBe('INCOMPLETE_BY_TIMEOUT');
  });

  it('exports configuration enums for interval and priority rules', () => {
    expect(IntervalCountMode.BY_EVENT).toBe('BY_EVENT');
    expect(IntervalCountMode.BY_DAY_OF_WEEK).toBe('BY_DAY_OF_WEEK');
    expect(DayOfWeek.SUNDAY).toBe('SUNDAY');
    expect(DayOfWeek.SATURDAY).toBe('SATURDAY');
  });

  it('exports notification types for in-app alerts', () => {
    expect(NotificationType.ADMIN_PROMOTED).toBe('ADMIN_PROMOTED');
    expect(NotificationType.MEMBERSHIP_APPROVED).toBe('MEMBERSHIP_APPROVED');
    expect(NotificationType.MEMBERSHIP_REJECTED).toBe('MEMBERSHIP_REJECTED');
  });

  it('exports organization plan tiers', () => {
    expect(PlanTier.BASIC).toBe('BASIC');
    expect(PlanTier.PRO).toBe('PRO');
    expect(PlanTier.ENTERPRISE).toBe('ENTERPRISE');
  });
});

describe('Prisma schema model coverage', () => {
  const expectedModels = [
    'User',
    'Organization',
    'Membership',
    'Role',
    'MembershipRolePreference',
    'Event',
    'DayOfWeekRequirement',
    'Availability',
    'ParticipationConfig',
    'IntervalRule',
    'PriorityRole',
    'Schedule',
    'ScheduleSlot',
    'Notification',
  ];

  it('generates a client entry for every planned entity', async () => {
    const { Prisma } = await import('@/generated/prisma/client');

    for (const model of expectedModels) {
      expect(Object.prototype.hasOwnProperty.call(Prisma.ModelName, model)).toBe(true);
    }
  });
});
