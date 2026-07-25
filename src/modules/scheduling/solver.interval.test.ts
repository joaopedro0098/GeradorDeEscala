import { describe, expect, it } from 'vitest';
import { buildIntervalConflictMap, createIntervalChecker } from './solver.interval';
import type { SolverEventInput } from './solver.types';

const WED = (n: number): SolverEventInput => ({
  id: `wed-${n}`,
  date: `2026-0${n}-01`,
  dayOfWeek: 'WEDNESDAY',
});

describe('createIntervalChecker', () => {
  const events: SolverEventInput[] = [
    { id: 'e1', date: '2026-08-05', dayOfWeek: 'WEDNESDAY' },
    { id: 'e2', date: '2026-08-07', dayOfWeek: 'FRIDAY' },
    { id: 'e3', date: '2026-08-09', dayOfWeek: 'SUNDAY' },
  ];

  it('flags a conflict regardless of which role the history entry used', () => {
    const violates = createIntervalChecker(events, { intervalCount: 1, countMode: 'BY_EVENT' });
    expect(violates([{ eventId: 'e1', roleId: 'drums' }], 'e2')).toBe(true);
    expect(violates([{ eventId: 'e1', roleId: 'drums' }], 'e3')).toBe(false);
  });

  it('never flags a conflict without a rule or with interval zero', () => {
    expect(createIntervalChecker(events, null)([{ eventId: 'e1', roleId: 'drums' }], 'e2')).toBe(
      false,
    );
    const zeroed = createIntervalChecker(events, { intervalCount: 0, countMode: 'BY_EVENT' });
    expect(zeroed([{ eventId: 'e1', roleId: 'drums' }], 'e2')).toBe(false);
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
      intervalCount: 1,
      countMode: 'BY_DAY_OF_WEEK',
    });

    expect(map.get('wed-1')).toEqual(new Set(['wed-2']));
    expect(map.get('wed-2')).toEqual(new Set(['wed-1', 'wed-3']));
    expect(map.get('fri-1')).toEqual(new Set(['fri-2']));
  });
});
