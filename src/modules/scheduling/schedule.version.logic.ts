import type { ScheduleStatus } from '@/generated/prisma/client';

export type ScheduleSlotSnapshot = {
  eventId: string;
  roleId: string;
  slotIndex: number;
  membershipId: string | null;
  isManual: boolean;
  isMinister: boolean;
};

export type ScheduleVisibilityState = {
  status: ScheduleStatus;
  hasPendingDraft: boolean;
  publishedSnapshotId: string | null;
};

/** Whether members can see any version of this schedule. */
export function isMemberScheduleVisible(state: ScheduleVisibilityState): boolean {
  return getMemberVisibleSlotSource(state) !== null;
}

/**
 * Which slot set members should read:
 * - snapshot while a draft regeneration is pending
 * - working copy in live-unified published mode
 * - null when never published / no frozen snapshot
 */
export function getMemberVisibleSlotSource(
  state: ScheduleVisibilityState,
): 'snapshot' | 'working' | null {
  if (state.publishedSnapshotId) return 'snapshot';
  if (state.status === 'PUBLISHED' && !state.hasPendingDraft) return 'working';
  return null;
}

/** Skip archiving on first generation when there is nothing to preserve. */
export function shouldSavePreviousVersionBeforeOverwrite(workingSlotCount: number): boolean {
  return workingSlotCount > 0;
}

/** After regenerating a published live schedule, members keep seeing a frozen snapshot. */
export function shouldFreezeSnapshotOnRegenerateFromPublished(state: ScheduleVisibilityState): boolean {
  return state.status === 'PUBLISHED' && !state.hasPendingDraft;
}

export function resolveHasPendingDraftAfterRegenerate(state: ScheduleVisibilityState): boolean {
  if (state.hasPendingDraft) return true;
  if (state.status === 'PUBLISHED' && !state.hasPendingDraft) return true;
  return false;
}

/**
 * Before undo replaces working slots, freeze the live published view so members
 * are not left without visibility (live-unified mode has no snapshot yet).
 */
export function shouldFreezeSnapshotBeforeUndo(state: ScheduleVisibilityState): boolean {
  return state.status === 'PUBLISHED' && !state.publishedSnapshotId;
}

export function resolveHasPendingDraftAfterUndo(input: {
  hadPublishedSnapshot: boolean;
  wasPublishedLive: boolean;
}): boolean {
  return input.hadPublishedSnapshot || input.wasPublishedLive;
}

export function canUndo(previousVersionExists: boolean): boolean {
  return previousVersionExists;
}

export function canPublishSchedule(input: {
  status: ScheduleStatus;
  hasWorkingSlots: boolean;
}): boolean {
  return input.hasWorkingSlots && input.status === 'DRAFT';
}
