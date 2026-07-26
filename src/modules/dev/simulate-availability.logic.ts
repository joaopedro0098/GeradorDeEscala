/**
 * Picks up to `count` event ids uniformly at random (Fisher–Yates).
 * Independent per call so members don't all get the same cult days.
 */
export function pickRandomEventIds(eventIds: string[], count: number): string[] {
  if (count <= 0 || eventIds.length === 0) return [];

  const take = Math.min(Math.floor(count), eventIds.length);
  const pool = [...eventIds];

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = pool[index];
    pool[index] = pool[swapIndex];
    pool[swapIndex] = current;
  }

  return pool.slice(0, take);
}
