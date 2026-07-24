import { describe, expect, it } from 'vitest';
import {
  canPublishSchedule,
  canUndo,
  getMemberVisibleSlotSource,
  isMemberScheduleVisible,
  resolveHasPendingDraftAfterRegenerate,
  resolveHasPendingDraftAfterUndo,
  shouldFreezeSnapshotBeforeUndo,
  shouldFreezeSnapshotOnRegenerateFromPublished,
  shouldSavePreviousVersionBeforeOverwrite,
} from './schedule.version.logic';

const draftInitial = { status: 'DRAFT' as const, hasPendingDraft: false, publishedSnapshotId: null };
const livePublished = { status: 'PUBLISHED' as const, hasPendingDraft: false, publishedSnapshotId: null };
const draftPending = {
  status: 'DRAFT' as const,
  hasPendingDraft: true,
  publishedSnapshotId: 'snap-1',
};

describe('shouldSavePreviousVersionBeforeOverwrite', () => {
  it('does not archive on first generation (no slots yet)', () => {
    expect(shouldSavePreviousVersionBeforeOverwrite(0)).toBe(false);
  });

  it('archives when there are working slots to preserve', () => {
    expect(shouldSavePreviousVersionBeforeOverwrite(3)).toBe(true);
  });
});

describe('getMemberVisibleSlotSource', () => {
  it('returns null for a never-published draft', () => {
    expect(getMemberVisibleSlotSource(draftInitial)).toBe(null);
    expect(isMemberScheduleVisible(draftInitial)).toBe(false);
  });

  it('returns working for live-unified published schedule', () => {
    expect(getMemberVisibleSlotSource(livePublished)).toBe('working');
    expect(isMemberScheduleVisible(livePublished)).toBe(true);
  });

  it('returns snapshot while a draft regeneration is pending', () => {
    expect(getMemberVisibleSlotSource(draftPending)).toBe('snapshot');
    expect(isMemberScheduleVisible(draftPending)).toBe(true);
  });
});

describe('regenerate from published', () => {
  it('requires freezing a snapshot and sets hasPendingDraft', () => {
    expect(shouldFreezeSnapshotOnRegenerateFromPublished(livePublished)).toBe(true);
    expect(resolveHasPendingDraftAfterRegenerate(livePublished)).toBe(true);
  });

  it('keeps hasPendingDraft when regenerating an already-pending draft', () => {
    expect(shouldFreezeSnapshotOnRegenerateFromPublished(draftPending)).toBe(false);
    expect(resolveHasPendingDraftAfterRegenerate(draftPending)).toBe(true);
  });

  it('leaves hasPendingDraft false for a never-published draft', () => {
    expect(shouldFreezeSnapshotOnRegenerateFromPublished(draftInitial)).toBe(false);
    expect(resolveHasPendingDraftAfterRegenerate(draftInitial)).toBe(false);
  });
});

describe('undoLastGeneration decisions', () => {
  it('freezes snapshot before undo in live-unified published mode', () => {
    expect(shouldFreezeSnapshotBeforeUndo(livePublished)).toBe(true);
    expect(
      resolveHasPendingDraftAfterUndo({
        hadPublishedSnapshot: false,
        wasPublishedLive: true,
      }),
    ).toBe(true);
  });

  it('does not re-freeze when a snapshot is already active', () => {
    expect(shouldFreezeSnapshotBeforeUndo(draftPending)).toBe(false);
    expect(
      resolveHasPendingDraftAfterUndo({
        hadPublishedSnapshot: true,
        wasPublishedLive: false,
      }),
    ).toBe(true);
  });

  it('leaves hasPendingDraft false when the schedule was never published', () => {
    expect(shouldFreezeSnapshotBeforeUndo(draftInitial)).toBe(false);
    expect(
      resolveHasPendingDraftAfterUndo({
        hadPublishedSnapshot: false,
        wasPublishedLive: false,
      }),
    ).toBe(false);
  });
});

describe('admin actions availability', () => {
  it('allows undo only when a previous version exists', () => {
    expect(canUndo(true)).toBe(true);
    expect(canUndo(false)).toBe(false);
  });

  it('allows publish only for drafts with working slots', () => {
    expect(canPublishSchedule({ status: 'DRAFT', hasWorkingSlots: true })).toBe(true);
    expect(canPublishSchedule({ status: 'PUBLISHED', hasWorkingSlots: true })).toBe(false);
    expect(canPublishSchedule({ status: 'DRAFT', hasWorkingSlots: false })).toBe(false);
  });
});

describe('manual edits on published schedule (live unified)', () => {
  it('members read the same working copy immediately without pending draft', () => {
    expect(getMemberVisibleSlotSource(livePublished)).toBe('working');
  });

  it('manual edits during pending draft do not affect member-visible snapshot source', () => {
    expect(getMemberVisibleSlotSource(draftPending)).toBe('snapshot');
  });
});
