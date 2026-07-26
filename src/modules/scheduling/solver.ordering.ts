export type DisputeCandidateScore = {
  membershipId: string;
  /** Preference level for the disputed role (lower = higher preference). */
  preferenceSortOrder: number;
  /** Times this member already has this role in the current month (so far). */
  periodCount: number;
  /** Times this member had this role in the previous month. */
  priorMonthCount: number;
};

/**
 * Dispute decision chain:
 *   1. Preference for the disputed role only (lower sortOrder wins).
 *   2. Current-month equity for that role (fewer wins).
 *   3. Prior-month equity for that role (fewer wins) — also covers the
 *      "new person with no history for this role" special case.
 *   4. Stable hash tie-break (same inputs → same winner).
 */
export function compareDisputeCandidates(
  a: DisputeCandidateScore,
  b: DisputeCandidateScore,
  tieBreakKey: string,
): number {
  if (a.preferenceSortOrder !== b.preferenceSortOrder) {
    return a.preferenceSortOrder - b.preferenceSortOrder;
  }
  if (a.periodCount !== b.periodCount) {
    return a.periodCount - b.periodCount;
  }
  if (a.priorMonthCount !== b.priorMonthCount) {
    return a.priorMonthCount - b.priorMonthCount;
  }
  return compareStableTieBreak(tieBreakKey, a.membershipId, b.membershipId);
}

/** FNV-1a 32-bit — deterministic across runs/platforms for the same string. */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function compareStableTieBreak(tieBreakKey: string, aId: string, bId: string): number {
  const hashA = hashString(`${tieBreakKey}::${aId}`);
  const hashB = hashString(`${tieBreakKey}::${bId}`);
  if (hashA !== hashB) return hashA - hashB;
  return aId.localeCompare(bId);
}

/**
 * PriorityRole.sortOrder first; remaining roles by createdAt (cadastro), then id.
 */
export function buildRoleProcessingOrder(
  priorityRoles: Array<{ roleId: string; sortOrder: number }>,
  allRoles: Array<{ id: string; createdAt: string }>,
): string[] {
  const ordered = [...priorityRoles]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.roleId.localeCompare(b.roleId))
    .map((role) => role.roleId);

  const seen = new Set(ordered);
  const rest = allRoles
    .filter((role) => !seen.has(role.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((role) => role.id);

  return [...ordered, ...rest];
}
