import { describe, expect, it } from 'vitest';
import {
  canGenerateScheduleForOrganization,
  getTrialProgress,
  isOrganizationSubscriptionActive,
  TRIAL_DAYS,
} from '@/modules/organizations/subscription.logic';

describe('subscription.logic', () => {
  const trialStart = new Date('2026-01-01T12:00:00.000Z');

  it('calculates trial progress by whole days', () => {
    const progress = getTrialProgress(trialStart, new Date('2026-01-06T23:59:59.000Z'));
    expect(progress.daysElapsed).toBe(5);
    expect(progress.daysRemaining).toBe(TRIAL_DAYS - 5);
    expect(progress.isExpired).toBe(false);
  });

  it('marks trial expired after 14 days', () => {
    const progress = getTrialProgress(trialStart, new Date('2026-01-15T00:00:00.000Z'));
    expect(progress.isExpired).toBe(true);
  });

  it('treats ACTIVE subscription as active regardless of trial', () => {
    expect(
      isOrganizationSubscriptionActive(
        { subscriptionStatus: 'ACTIVE', trialStartedAt: trialStart },
        new Date('2026-02-01T00:00:00.000Z'),
      ),
    ).toBe(true);
  });

  it('does not block schedule generation while enforcement is disabled', () => {
    expect(
      canGenerateScheduleForOrganization(
        { subscriptionStatus: 'EXPIRED', trialStartedAt: trialStart },
        new Date('2026-02-01T00:00:00.000Z'),
      ).allowed,
    ).toBe(true);
  });
});
