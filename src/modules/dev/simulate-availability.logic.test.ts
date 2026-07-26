import { describe, expect, it } from 'vitest';
import { pickRandomEventIds } from './simulate-availability.logic';

describe('pickRandomEventIds', () => {
  it('returns empty when count is zero or there are no events', () => {
    expect(pickRandomEventIds(['a', 'b'], 0)).toEqual([]);
    expect(pickRandomEventIds([], 3)).toEqual([]);
  });

  it('never returns more ids than available events', () => {
    const picked = pickRandomEventIds(['a', 'b', 'c'], 10);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
  });

  it('returns a subset of the input ids', () => {
    const input = ['e1', 'e2', 'e3', 'e4', 'e5'];
    const picked = pickRandomEventIds(input, 3);
    expect(picked).toHaveLength(3);
    for (const id of picked) {
      expect(input).toContain(id);
    }
  });
});
