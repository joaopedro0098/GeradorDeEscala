import { describe, expect, it } from 'vitest';
import {
  extractRecurringWeekdays,
  inheritEventDateKeys,
  isWithinHistoryRange,
  listHistoryMonths,
  resolveWorkingMonth,
} from '@/modules/scheduling/working-month.logic';

const AUGUST_2026 = { year: 2026, month: 8 };
const SEPTEMBER_2026 = { year: 2026, month: 9 };
const NOW = new Date(Date.UTC(2026, 7, 24));

describe('resolveWorkingMonth', () => {
  it('falls back to the current month when nothing was ever chosen', () => {
    expect(resolveWorkingMonth(null, NOW)).toEqual(AUGUST_2026);
    expect(resolveWorkingMonth({ year: null, month: null }, NOW)).toEqual(AUGUST_2026);
  });

  it('moves forward when the stored month already passed', () => {
    expect(resolveWorkingMonth({ year: 2026, month: 5 }, NOW)).toEqual(AUGUST_2026);
    expect(resolveWorkingMonth({ year: 2025, month: 12 }, NOW)).toEqual(AUGUST_2026);
  });

  it('keeps the stored month when it is the current one or ahead', () => {
    expect(resolveWorkingMonth(AUGUST_2026, NOW)).toEqual(AUGUST_2026);
    expect(resolveWorkingMonth({ year: 2027, month: 2 }, NOW)).toEqual({ year: 2027, month: 2 });
  });
});

describe('schedule history range', () => {
  it('lists the twelve months before the working month, most recent first', () => {
    const months = listHistoryMonths(AUGUST_2026);
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ year: 2026, month: 7 });
    expect(months[11]).toEqual({ year: 2025, month: 8 });
  });

  it('accepts only past months inside the twelve-month window', () => {
    expect(isWithinHistoryRange({ year: 2026, month: 7 }, AUGUST_2026)).toBe(true);
    expect(isWithinHistoryRange({ year: 2025, month: 8 }, AUGUST_2026)).toBe(true);
    expect(isWithinHistoryRange({ year: 2025, month: 7 }, AUGUST_2026)).toBe(false);
    expect(isWithinHistoryRange(AUGUST_2026, AUGUST_2026)).toBe(false);
    expect(isWithinHistoryRange(SEPTEMBER_2026, AUGUST_2026)).toBe(false);
  });
});

describe('extractRecurringWeekdays', () => {
  it('detects a weekday marked on every occurrence', () => {
    const allWednesdays = ['2026-08-05', '2026-08-12', '2026-08-19', '2026-08-26'];
    expect(extractRecurringWeekdays(AUGUST_2026, allWednesdays)).toEqual(['WEDNESDAY']);
  });

  it('keeps a weekday that had a single skipped occurrence', () => {
    const mostSundays = ['2026-08-02', '2026-08-09', '2026-08-16', '2026-08-23'];
    expect(extractRecurringWeekdays(AUGUST_2026, mostSundays)).toEqual(['SUNDAY']);
  });

  it('ignores a one-off day that is not part of a pattern', () => {
    expect(extractRecurringWeekdays(AUGUST_2026, ['2026-08-01'])).toEqual([]);
  });

  it('returns nothing for a month without marks', () => {
    expect(extractRecurringWeekdays(AUGUST_2026, [])).toEqual([]);
  });
});

describe('inheritEventDateKeys', () => {
  it('repeats the previous month pattern on every matching day of the target month', () => {
    const inherited = inheritEventDateKeys({
      source: AUGUST_2026,
      sourceDateKeys: [
        '2026-08-05',
        '2026-08-12',
        '2026-08-19',
        '2026-08-26',
        '2026-08-02',
        '2026-08-09',
        '2026-08-16',
        '2026-08-23',
        '2026-08-30',
      ],
      target: SEPTEMBER_2026,
    });

    expect(inherited).toEqual([
      '2026-09-02',
      '2026-09-06',
      '2026-09-09',
      '2026-09-13',
      '2026-09-16',
      '2026-09-20',
      '2026-09-23',
      '2026-09-27',
      '2026-09-30',
    ]);
  });

  it('inherits nothing when the previous month had no events', () => {
    expect(
      inheritEventDateKeys({ source: AUGUST_2026, sourceDateKeys: [], target: SEPTEMBER_2026 }),
    ).toEqual([]);
  });
});
