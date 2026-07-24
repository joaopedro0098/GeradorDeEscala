import { describe, expect, it } from 'vitest';
import { buildIntervalConflictMap, resolveIntervalRule } from './solver.interval';
import type { SolverEventInput, SolverIntervalRuleInput } from './solver.types';

const WED = (n: number): SolverEventInput => ({
  id: `wed-${n}`,
  date: `2026-0${n}-01`,
  dayOfWeek: 'WEDNESDAY',
});

describe('resolveIntervalRule', () => {
  const rules: SolverIntervalRuleInput[] = [
    { roleId: null, intervalCount: 1, countMode: 'BY_EVENT' },
    { roleId: 'drums', intervalCount: 2, countMode: 'BY_DAY_OF_WEEK' },
  ];

  it('prefers the role-specific rule over the general rule', () => {
    expect(resolveIntervalRule('drums', rules)).toEqual(rules[1]);
  });

  it('falls back to the general rule when no role-specific rule exists', () => {
    expect(resolveIntervalRule('vocals', rules)).toEqual(rules[0]);
  });

  it('returns null when neither exists', () => {
    expect(resolveIntervalRule('vocals', [])).toBeNull();
  });
});

describe('buildIntervalConflictMap — BY_EVENT', () => {
  it('blocks the N chronologically nearest events on both sides', () => {
    const events: SolverEventInput[] = [
      { id: 'e1', date: '2026-08-05', dayOfWeek: 'WEDNESDAY' },
      { id: 'e2', date: '2026-08-07', dayOfWeek: 'FRIDAY' },
      { id: 'e3', date: '2026-08-09', dayOfWeek: 'SUNDAY' },
      { id: 'e4', date: '2026-08-12', dayOfWeek: 'WEDNESDAY' },
    ];

    const map = buildIntervalConflictMap(events, {
      roleId: null,
      intervalCount: 1,
      countMode: 'BY_EVENT',
    });

    expect(map.get('e2')).toEqual(new Set(['e1', 'e3']));
    expect(map.get('e1')).toEqual(new Set(['e2']));
    expect(map.get('e4')).toEqual(new Set(['e3']));
  });

  it('extends the window with a larger interval count', () => {
    const events: SolverEventInput[] = [
      { id: 'e1', date: '2026-08-05', dayOfWeek: 'WEDNESDAY' },
      { id: 'e2', date: '2026-08-07', dayOfWeek: 'FRIDAY' },
      { id: 'e3', date: '2026-08-09', dayOfWeek: 'SUNDAY' },
      { id: 'e4', date: '2026-08-12', dayOfWeek: 'WEDNESDAY' },
    ];

    const map = buildIntervalConflictMap(events, {
      roleId: null,
      intervalCount: 2,
      countMode: 'BY_EVENT',
    });

    expect(map.get('e1')).toEqual(new Set(['e2', 'e3']));
  });

  it('produces empty conflict sets when intervalCount is zero', () => {
    const events: SolverEventInput[] = [
      { id: 'e1', date: '2026-08-05', dayOfWeek: 'WEDNESDAY' },
      { id: 'e2', date: '2026-08-07', dayOfWeek: 'FRIDAY' },
    ];

    const map = buildIntervalConflictMap(events, {
      roleId: null,
      intervalCount: 0,
      countMode: 'BY_EVENT',
    });

    expect(map.get('e1')).toEqual(new Set());
    expect(map.get('e2')).toEqual(new Set());
  });
});

describe('buildIntervalConflictMap — BY_DAY_OF_WEEK', () => {
  it('only counts events sharing the same weekday, skipping others in between', () => {
    const events: SolverEventInput[] = [
      WED(1),
      { id: 'fri-1', date: '2026-01-03', dayOfWeek: 'FRIDAY' },
      WED(2),
      { id: 'fri-2', date: '2026-01-10', dayOfWeek: 'FRIDAY' },
      WED(3),
    ];

    const map = buildIntervalConflictMap(events, {
      roleId: null,
      intervalCount: 1,
      countMode: 'BY_DAY_OF_WEEK',
    });

    expect(map.get('wed-1')).toEqual(new Set(['wed-2']));
    expect(map.get('wed-2')).toEqual(new Set(['wed-1', 'wed-3']));
    expect(map.get('fri-1')).toEqual(new Set(['fri-2']));
  });
});
