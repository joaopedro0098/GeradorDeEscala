import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadLastScheduleView,
  resolveOfflineScheduleView,
  saveLastScheduleView,
} from './schedule-offline-cache';
import type { ScheduleOverview } from '@/modules/scheduling/schedule.types';

const overview: ScheduleOverview = {
  scheduleId: 'sched-1',
  year: 2026,
  month: 8,
  status: 'PUBLISHED',
  generationStatus: 'COMPLETE',
  hasPublishedGaps: false,
  publishedAt: '2026-08-01T00:00:00.000Z',
  hasPendingDraft: false,
  hasPreviousVersion: false,
  hasManualSlots: false,
  memberVisiblePublishedAt: '2026-08-01T00:00:00.000Z',
  events: [],
  memberCounts: [],
};

describe('schedule-offline-cache', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists and loads the last viewed schedule for an audience/org', () => {
    saveLastScheduleView('member', 'org-1', {
      year: 2026,
      month: 8,
      selectedDate: '2026-08-02',
      overview,
    });

    const cached = loadLastScheduleView('member', 'org-1');
    expect(cached?.year).toBe(2026);
    expect(cached?.month).toBe(8);
    expect(cached?.selectedDate).toBe('2026-08-02');
    expect(cached?.overview.scheduleId).toBe('sched-1');
    expect(cached?.savedAt).toBeTruthy();
  });

  it('returns live data when online and server overview is available', () => {
    const resolved = resolveOfflineScheduleView({
      audience: 'admin',
      organizationId: 'org-1',
      year: 2026,
      month: 8,
      serverOverview: overview,
      isOnline: true,
    });

    expect(resolved.mode).toBe('live');
    expect(resolved.overview?.scheduleId).toBe('sched-1');
  });

  it('falls back to cached data when offline', () => {
    saveLastScheduleView('member', 'org-1', {
      year: 2026,
      month: 8,
      overview,
    });

    const resolved = resolveOfflineScheduleView({
      audience: 'member',
      organizationId: 'org-1',
      year: 2026,
      month: 8,
      serverOverview: null,
      isOnline: false,
    });

    expect(resolved.mode).toBe('cached');
    expect(resolved.overview?.scheduleId).toBe('sched-1');
    expect(resolved.cachedAt).toBeTruthy();
  });

  it('returns unavailable when offline and there is no cache', () => {
    const resolved = resolveOfflineScheduleView({
      audience: 'member',
      organizationId: 'org-1',
      year: 2026,
      month: 8,
      serverOverview: null,
      isOnline: false,
    });

    expect(resolved.mode).toBe('unavailable');
    expect(resolved.overview).toBeNull();
  });
});
