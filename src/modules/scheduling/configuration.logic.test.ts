import { describe, expect, it } from 'vitest';
import {
  buildMonthGrid,
  formatDateKey,
  getDayOfWeekFromDateKey,
  normalizeRoleName,
  reorderPriorityRoleIds,
  validateIntervalCount,
  validateMinimumDays,
  validateQuantity,
} from '@/modules/scheduling/configuration.logic';

describe('configuration.logic', () => {
  it('builds a month grid with leading empty cells', () => {
    const grid = buildMonthGrid(2026, 8);
    expect(grid.length % 7).toBe(0);
    expect(grid.filter(Boolean)).toHaveLength(31);
  });

  it('formats and parses date keys consistently', () => {
    const key = formatDateKey(new Date(Date.UTC(2026, 7, 3)));
    expect(key).toBe('2026-08-03');
    expect(getDayOfWeekFromDateKey(key)).toBe('MONDAY');
  });

  it('normalizes role names', () => {
    expect(normalizeRoleName('  Vocal   Principal  ')).toBe('Vocal Principal');
  });

  it('validates numeric configuration inputs', () => {
    expect(validateQuantity(2)).toBe(true);
    expect(validateQuantity(-1)).toBe(false);
    expect(validateMinimumDays(4)).toBe(true);
    expect(validateIntervalCount(1)).toBe(true);
  });

  it('reorders priority roles without mutating original list', () => {
    const current = ['a', 'b', 'c'];
    const next = reorderPriorityRoleIds(current, 'b', 'up');
    expect(next).toEqual(['b', 'a', 'c']);
    expect(current).toEqual(['a', 'b', 'c']);
  });
});
