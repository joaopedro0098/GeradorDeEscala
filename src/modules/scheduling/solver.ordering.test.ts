import { describe, expect, it } from 'vitest';
import { compareCandidates, compareRelaxedCandidates, compareVariables } from './solver.ordering';

describe('compareCandidates (4.3 precedence)', () => {
  it('ranks the exclusive candidate above a multi-role candidate regardless of preference order', () => {
    // Diego only plays drums (exclusive); João prefers drums 1st but plays multiple instruments.
    const diego = {
      isExclusive: true,
      preferenceSortOrder: 1,
      periodCount: 3,
      priorMonthCount: 3,
      hasFlexibleGroupMateScheduled: false,
    };
    const joao = {
      isExclusive: false,
      preferenceSortOrder: 1,
      periodCount: 0,
      priorMonthCount: 0,
      hasFlexibleGroupMateScheduled: false,
    };

    expect(compareCandidates(diego, joao)).toBeLessThan(0);
    expect(compareCandidates(joao, diego)).toBeGreaterThan(0);
  });

  it('falls back to personal preference order when exclusivity ties', () => {
    const first = {
      isExclusive: false,
      preferenceSortOrder: 1,
      periodCount: 5,
      priorMonthCount: 5,
      hasFlexibleGroupMateScheduled: false,
    };
    const second = {
      isExclusive: false,
      preferenceSortOrder: 2,
      periodCount: 0,
      priorMonthCount: 0,
      hasFlexibleGroupMateScheduled: false,
    };

    expect(compareCandidates(first, second)).toBeLessThan(0);
  });

  it('falls back to current-period equity when exclusivity and preference tie', () => {
    const lessUsed = {
      isExclusive: false,
      preferenceSortOrder: 1,
      periodCount: 1,
      priorMonthCount: 9,
      hasFlexibleGroupMateScheduled: false,
    };
    const moreUsed = {
      isExclusive: false,
      preferenceSortOrder: 1,
      periodCount: 3,
      priorMonthCount: 0,
      hasFlexibleGroupMateScheduled: false,
    };

    expect(compareCandidates(lessUsed, moreUsed)).toBeLessThan(0);
  });

  it('prefers a candidate with a flexible group mate already scheduled when equity ties', () => {
    const withGroupMate = {
      isExclusive: false,
      preferenceSortOrder: 1,
      periodCount: 2,
      priorMonthCount: 9,
      hasFlexibleGroupMateScheduled: true,
    };
    const withoutGroupMate = {
      isExclusive: false,
      preferenceSortOrder: 1,
      periodCount: 2,
      priorMonthCount: 0,
      hasFlexibleGroupMateScheduled: false,
    };

    expect(compareCandidates(withGroupMate, withoutGroupMate)).toBeLessThan(0);
  });

  it('never lets flexible group affinity override exclusivity, preference, or current-period equity', () => {
    const exclusiveNoGroup = {
      isExclusive: true,
      preferenceSortOrder: 1,
      periodCount: 5,
      priorMonthCount: 5,
      hasFlexibleGroupMateScheduled: false,
    };
    const nonExclusiveWithGroup = {
      isExclusive: false,
      preferenceSortOrder: 1,
      periodCount: 0,
      priorMonthCount: 0,
      hasFlexibleGroupMateScheduled: true,
    };

    expect(compareCandidates(exclusiveNoGroup, nonExclusiveWithGroup)).toBeLessThan(0);
  });

  it('uses previous-period occupation as the final tie-break', () => {
    const wentLongerWithout = {
      isExclusive: false,
      preferenceSortOrder: 1,
      periodCount: 2,
      priorMonthCount: 0,
      hasFlexibleGroupMateScheduled: false,
    };
    const recentlyOccupied = {
      isExclusive: false,
      preferenceSortOrder: 1,
      periodCount: 2,
      priorMonthCount: 4,
      hasFlexibleGroupMateScheduled: false,
    };

    expect(compareCandidates(wentLongerWithout, recentlyOccupied)).toBeLessThan(0);
  });
});

describe('compareRelaxedCandidates (4.2 scarcity fallback)', () => {
  it('only considers current-period participation count', () => {
    expect(compareRelaxedCandidates({ periodCount: 1 }, { periodCount: 4 })).toBeLessThan(0);
    expect(compareRelaxedCandidates({ periodCount: 4 }, { periodCount: 4 })).toBe(0);
  });
});

describe('compareVariables (priority-first + MRV)', () => {
  it('orders high-priority slots before non-priority ones', () => {
    const priority = { priorityRank: 1, domainSize: 10, eventIndex: 5 };
    const nonPriority = { priorityRank: null, domainSize: 1, eventIndex: 0 };

    expect(compareVariables(priority, nonPriority)).toBeLessThan(0);
  });

  it('orders by ascending priority rank when both are priority roles', () => {
    const higher = { priorityRank: 1, domainSize: 10, eventIndex: 0 };
    const lower = { priorityRank: 2, domainSize: 1, eventIndex: 0 };

    expect(compareVariables(higher, lower)).toBeLessThan(0);
  });

  it('uses domain size (MRV) as a tie-break among equal priority', () => {
    const scarce = { priorityRank: null, domainSize: 1, eventIndex: 10 };
    const abundant = { priorityRank: null, domainSize: 5, eventIndex: 0 };

    expect(compareVariables(scarce, abundant)).toBeLessThan(0);
  });

  it('uses chronological event index as the final tie-break', () => {
    const earlier = { priorityRank: null, domainSize: 3, eventIndex: 0 };
    const later = { priorityRank: null, domainSize: 3, eventIndex: 1 };

    expect(compareVariables(earlier, later)).toBeLessThan(0);
  });
});
