import type { DayOfWeek } from '@/generated/prisma/client';
import { DAY_OF_WEEK_ORDER } from './types';

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDayOfWeekFromDateKey(dateKey: string): DayOfWeek {
  const date = parseDateKey(dateKey);
  return DAY_OF_WEEK_ORDER[date.getUTCDay()];
}

export function buildMonthGrid(year: number, month: number): Array<string | null> {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingEmpty = firstDay.getUTCDay();
  const cells: Array<string | null> = Array.from({ length: leadingEmpty }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(formatDateKey(new Date(Date.UTC(year, month - 1, day))));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export function normalizeRoleName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function validateQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= 0;
}

export function validateMinimumDays(minimumDays: number): boolean {
  return Number.isInteger(minimumDays) && minimumDays >= 0;
}

export function validateIntervalCount(intervalCount: number): boolean {
  return Number.isInteger(intervalCount) && intervalCount >= 0;
}

export function reorderPriorityRoleIds(
  currentRoleIds: string[],
  roleId: string,
  direction: 'up' | 'down',
): string[] {
  const index = currentRoleIds.indexOf(roleId);
  if (index === -1) return currentRoleIds;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= currentRoleIds.length) {
    return currentRoleIds;
  }

  const next = [...currentRoleIds];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}
