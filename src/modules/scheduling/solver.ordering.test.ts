import { describe, expect, it } from 'vitest';
import {
  buildRoleProcessingOrder,
  compareDisputeCandidates,
  compareStableTieBreak,
  hashString,
} from './solver.ordering';

describe('compareDisputeCandidates', () => {
  const key = 'e1::drums::0';

  it('prefers lower preference sortOrder for the disputed role', () => {
    const first = {
      membershipId: 'a',
      preferenceSortOrder: 1,
      periodCount: 5,
      priorMonthCount: 5,
    };
    const second = {
      membershipId: 'b',
      preferenceSortOrder: 2,
      periodCount: 0,
      priorMonthCount: 0,
    };

    expect(compareDisputeCandidates(first, second, key)).toBeLessThan(0);
  });

  it('breaks preference ties with current-month equity', () => {
    const lessUsed = {
      membershipId: 'a',
      preferenceSortOrder: 1,
      periodCount: 1,
      priorMonthCount: 9,
    };
    const moreUsed = {
      membershipId: 'b',
      preferenceSortOrder: 1,
      periodCount: 3,
      priorMonthCount: 0,
    };

    expect(compareDisputeCandidates(lessUsed, moreUsed, key)).toBeLessThan(0);
  });

  it('breaks period ties with prior-month equity (new person wins)', () => {
    const newbie = {
      membershipId: 'a',
      preferenceSortOrder: 1,
      periodCount: 0,
      priorMonthCount: 0,
    };
    const veteran = {
      membershipId: 'b',
      preferenceSortOrder: 1,
      periodCount: 0,
      priorMonthCount: 4,
    };

    expect(compareDisputeCandidates(newbie, veteran, key)).toBeLessThan(0);
  });

  it('uses a stable hash when everything else ties', () => {
    const a = {
      membershipId: 'mem-a',
      preferenceSortOrder: 1,
      periodCount: 0,
      priorMonthCount: 0,
    };
    const b = {
      membershipId: 'mem-b',
      preferenceSortOrder: 1,
      periodCount: 0,
      priorMonthCount: 0,
    };

    const first = compareDisputeCandidates(a, b, key);
    const second = compareDisputeCandidates(a, b, key);
    expect(first).toBe(second);
    expect(first).not.toBe(0);
  });
});

describe('buildRoleProcessingOrder', () => {
  it('orders PriorityRole first, then remaining by createdAt', () => {
    const order = buildRoleProcessingOrder(
      [
        { roleId: 'drums', sortOrder: 2 },
        { roleId: 'vocal', sortOrder: 1 },
      ],
      [
        { id: 'guitar', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'vocal', createdAt: '2026-01-02T00:00:00.000Z' },
        { id: 'drums', createdAt: '2026-01-03T00:00:00.000Z' },
        { id: 'keys', createdAt: '2026-01-04T00:00:00.000Z' },
      ],
    );

    expect(order).toEqual(['vocal', 'drums', 'guitar', 'keys']);
  });
});

describe('stable tie-break helpers', () => {
  it('hashes the same string to the same value', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
  });

  it('compareStableTieBreak is antisymmetric and deterministic', () => {
    const key = 'seed';
    expect(compareStableTieBreak(key, 'a', 'b')).toBe(-compareStableTieBreak(key, 'b', 'a'));
  });
});
