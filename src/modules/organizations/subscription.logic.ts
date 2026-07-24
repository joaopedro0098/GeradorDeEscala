import type { SubscriptionStatus } from '@/generated/prisma/client';

/** Ative quando Stripe/webhook estiver pronto. */
export const ENFORCE_SUBSCRIPTION = false;

export const TRIAL_DAYS = 14;

export type SubscriptionSnapshot = {
  subscriptionStatus: SubscriptionStatus;
  trialStartedAt: Date;
};

export type TrialProgress = {
  daysElapsed: number;
  daysRemaining: number;
  percentComplete: number;
  isExpired: boolean;
};

export function getTrialProgress(trialStartedAt: Date, now = new Date()): TrialProgress {
  const start = startOfUtcDay(trialStartedAt);
  const today = startOfUtcDay(now);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysElapsed = Math.max(0, Math.floor((today.getTime() - start.getTime()) / msPerDay));
  const daysRemaining = Math.max(0, TRIAL_DAYS - daysElapsed);
  const percentComplete = Math.min(100, Math.round((daysElapsed / TRIAL_DAYS) * 100));

  return {
    daysElapsed,
    daysRemaining,
    percentComplete,
    isExpired: daysElapsed >= TRIAL_DAYS,
  };
}

export function isOrganizationSubscriptionActive(
  organization: SubscriptionSnapshot,
  now = new Date(),
): boolean {
  if (organization.subscriptionStatus === 'ACTIVE') return true;
  if (organization.subscriptionStatus === 'EXPIRED') return false;
  return !getTrialProgress(organization.trialStartedAt, now).isExpired;
}

export function canGenerateScheduleForOrganization(
  organization: SubscriptionSnapshot,
  now = new Date(),
): { allowed: boolean; reason?: string } {
  if (!ENFORCE_SUBSCRIPTION) {
    return { allowed: true };
  }

  if (isOrganizationSubscriptionActive(organization, now)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Assine um plano para continuar gerando escalas.',
  };
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
