import { describe, expect, it } from 'vitest';
import {
  DayOfWeek,
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

  it('exports day-of-week values for formation rules', () => {
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
    'PriorityRole',
    'Schedule',
    'ScheduleSlot',
    'Notification',
  ];

  const removedModels = [
    'IntervalRule',
    'MemberGroup',
    'GroupMembership',
    'MembershipRoleCombination',
  ];

  it('generates a client entry for every planned entity', async () => {
    const { Prisma } = await import('@/generated/prisma/client');

    for (const model of expectedModels) {
      expect(Object.prototype.hasOwnProperty.call(Prisma.ModelName, model)).toBe(true);
    }
  });

  it('no longer exposes removed scheduling models', async () => {
    const { Prisma } = await import('@/generated/prisma/client');

    for (const model of removedModels) {
      expect(Object.prototype.hasOwnProperty.call(Prisma.ModelName, model)).toBe(false);
    }
  });
});
