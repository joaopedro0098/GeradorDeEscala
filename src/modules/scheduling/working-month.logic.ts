import { formatDateKey, getDayOfWeekFromDateKey } from './configuration.logic';
import type { DayOfWeek } from '@/generated/prisma/client';

export type YearMonth = {
  year: number;
  month: number;
};

/** How many past months stay reachable in the read-only schedule history. */
export const HISTORY_MONTHS = 12;

export function currentYearMonth(now: Date): YearMonth {
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export function isSameYearMonth(a: YearMonth, b: YearMonth): boolean {
  return compareYearMonth(a, b) === 0;
}

export function shiftYearMonth(base: YearMonth, delta: number): YearMonth {
  const shifted = new Date(Date.UTC(base.year, base.month - 1 + delta, 1));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

export function isValidYearMonth(value: {
  year: number | null | undefined;
  month: number | null | undefined;
}): value is YearMonth {
  const { year, month } = value;
  if (typeof year !== 'number' || typeof month !== 'number') return false;
  if (!Number.isInteger(year) || !Number.isInteger(month)) return false;
  return year >= 1970 && year <= 9999 && month >= 1 && month <= 12;
}

/**
 * The organization always works on the stored month, except when it already
 * lies in the past — then it moves forward to the current month, because past
 * months are read-only.
 */
export function resolveWorkingMonth(
  stored: { year: number | null; month: number | null } | null,
  now: Date,
): YearMonth {
  const current = currentYearMonth(now);
  if (!stored || !isValidYearMonth(stored)) return current;
  return compareYearMonth(stored, current) < 0 ? current : stored;
}

/** Months reachable in read-only mode, most recent first. */
export function listHistoryMonths(
  workingMonth: YearMonth,
  count: number = HISTORY_MONTHS,
): YearMonth[] {
  return Array.from({ length: count }, (_, index) => shiftYearMonth(workingMonth, -(index + 1)));
}

export function isWithinHistoryRange(
  candidate: YearMonth,
  workingMonth: YearMonth,
  count: number = HISTORY_MONTHS,
): boolean {
  if (compareYearMonth(candidate, workingMonth) >= 0) return false;
  const oldest = shiftYearMonth(workingMonth, -count);
  return compareYearMonth(candidate, oldest) >= 0;
}

export function formatYearMonth(value: YearMonth): string {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(value.year, value.month - 1, 1)));
}

function listDateKeysOfMonth({ year, month }: YearMonth): string[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, index) =>
    formatDateKey(new Date(Date.UTC(year, month - 1, index + 1))),
  );
}

/**
 * Weekdays that form the recurring pattern of a month: a weekday counts when at
 * least half of its occurrences were marked, so a month with one skipped
 * Wednesday still carries "every Wednesday" forward, while a one-off Saturday
 * does not turn into every Saturday.
 */
export function extractRecurringWeekdays(source: YearMonth, markedDateKeys: string[]): DayOfWeek[] {
  const marked = new Set(markedDateKeys);
  const total = new Map<DayOfWeek, number>();
  const hits = new Map<DayOfWeek, number>();

  for (const dateKey of listDateKeysOfMonth(source)) {
    const dayOfWeek = getDayOfWeekFromDateKey(dateKey);
    total.set(dayOfWeek, (total.get(dayOfWeek) ?? 0) + 1);
    if (marked.has(dateKey)) {
      hits.set(dayOfWeek, (hits.get(dayOfWeek) ?? 0) + 1);
    }
  }

  const recurring: DayOfWeek[] = [];
  for (const [dayOfWeek, hitCount] of hits) {
    const occurrences = total.get(dayOfWeek) ?? 0;
    if (hitCount * 2 >= occurrences) recurring.push(dayOfWeek);
  }
  return recurring;
}

/**
 * Dates the target month inherits from the month right before it, by repeating
 * the previous month's recurring weekdays.
 */
export function inheritEventDateKeys(input: {
  source: YearMonth;
  sourceDateKeys: string[];
  target: YearMonth;
}): string[] {
  const recurring = new Set(extractRecurringWeekdays(input.source, input.sourceDateKeys));
  if (recurring.size === 0) return [];

  return listDateKeysOfMonth(input.target).filter((dateKey) =>
    recurring.has(getDayOfWeekFromDateKey(dateKey)),
  );
}
