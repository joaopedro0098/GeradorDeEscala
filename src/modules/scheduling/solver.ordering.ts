export type CandidateScoreContext = {
  /** True when the candidate has only this one role registered at all (4.3). */
  isExclusive: boolean;
  /** Position of this role in the candidate's personal preference list (lower = more preferred). */
  preferenceSortOrder: number;
  /** Occurrences of this specific role for this candidate in the current period. */
  periodCount: number;
  /** Occurrences of this specific role for this candidate in the previous period (tie-break). */
  priorMonthCount: number;
  /**
   * True when a fellow member of this candidate's FLEXIBLE group is already
   * scheduled (any role) at the same event. A weak tie-break only — it never
   * outranks exclusivity, preference, or current-period equity, and only
   * breaks ties before the previous-period equity criterion.
   */
  hasFlexibleGroupMateScheduled: boolean;
};

/**
 * Orders candidates for a normal (interval-respecting) slot assignment,
 * following the confirmed 4.3 precedence:
 *   1. Exclusivity — a single-role member outranks a multi-role member.
 *   2. Personal preference — lower sortOrder for this role wins.
 *   3. Equity (current period) — fewer prior occurrences of this role wins.
 *   4. FLEXIBLE member-group affinity — having a group mate already
 *      scheduled at the same event wins, as a soft nudge to keep groups
 *      together (never mandatory, never generates a blank on its own).
 *   5. Equity tie-break (previous period) — fewer prior-period occurrences wins.
 */
export function compareCandidates(a: CandidateScoreContext, b: CandidateScoreContext): number {
  if (a.isExclusive !== b.isExclusive) return a.isExclusive ? -1 : 1;
  if (a.preferenceSortOrder !== b.preferenceSortOrder) {
    return a.preferenceSortOrder - b.preferenceSortOrder;
  }
  if (a.periodCount !== b.periodCount) return a.periodCount - b.periodCount;
  if (a.hasFlexibleGroupMateScheduled !== b.hasFlexibleGroupMateScheduled) {
    return a.hasFlexibleGroupMateScheduled ? -1 : 1;
  }
  return a.priorMonthCount - b.priorMonthCount;
}

/**
 * Orders candidates for a relaxed (interval-violating) high-priority
 * fallback assignment (4.2): the only criterion is who has participated
 * least in the current period so far.
 */
export function compareRelaxedCandidates(
  a: { periodCount: number },
  b: { periodCount: number },
): number {
  return a.periodCount - b.periodCount;
}

export type VariableOrderingContext = {
  /** Priority rank of the role (lower = more essential), or null when not a priority role. */
  priorityRank: number | null;
  /** Size of the statically eligible domain (availability + competency only), for MRV ordering. */
  domainSize: number;
  /** Chronological index of the event, used as a stable final tie-break. */
  eventIndex: number;
};

/**
 * Orders solver variables (slots to fill) so that:
 *   1. High-priority roles are scheduled first, in their configured order (4.2, surplus scenario).
 *   2. Among equal priority, the most constrained slots (fewest eligible candidates) go first (MRV).
 *   3. Ties are broken chronologically for determinism.
 */
export function compareVariables(a: VariableOrderingContext, b: VariableOrderingContext): number {
  const aPriority = a.priorityRank ?? Number.POSITIVE_INFINITY;
  const bPriority = b.priorityRank ?? Number.POSITIVE_INFINITY;
  if (aPriority !== bPriority) return aPriority - bPriority;
  if (a.domainSize !== b.domainSize) return a.domainSize - b.domainSize;
  return a.eventIndex - b.eventIndex;
}
