import type { DayOfWeek } from '@/generated/prisma/client';
import type { SolverEventInput, SolverIntervalRuleInput } from './solver.types';

/**
 * Resolves the interval rule that applies to a given role: a role-specific
 * rule takes precedence over the organization-wide (GENERAL) rule.
 *
 * By design (4.1), the role-specific rule replaces the general rule for that
 * role rather than stacking with it — a role-specific rule scopes the
 * interval check to occurrences of that same role, while the general rule
 * scopes the check to occurrences of any role.
 */
export function resolveIntervalRule(
  roleId: string,
  intervalRules: SolverIntervalRuleInput[],
): SolverIntervalRuleInput | null {
  const specific = intervalRules.find((rule) => rule.roleId === roleId);
  if (specific) return specific;
  return intervalRules.find((rule) => rule.roleId === null) ?? null;
}

/**
 * Builds, for every event, the set of event ids that would conflict with an
 * assignment made on that event under the given interval rule.
 *
 * - `BY_EVENT`: counts the N chronologically nearest events (regardless of
 *   weekday) on either side.
 * - `BY_DAY_OF_WEEK`: counts the N nearest events that fall on the same
 *   weekday (e.g. interval=1 on Wednesday blocks only the next Wednesday,
 *   not the Friday in between).
 */
export function buildIntervalConflictMap(
  sortedEvents: SolverEventInput[],
  rule: SolverIntervalRuleInput,
): Map<string, Set<string>> {
  const conflictMap = new Map<string, Set<string>>();

  if (rule.intervalCount <= 0) {
    for (const event of sortedEvents) {
      conflictMap.set(event.id, new Set());
    }
    return conflictMap;
  }

  if (rule.countMode === 'BY_EVENT') {
    populateConflicts(sortedEvents, rule.intervalCount, conflictMap);
    return conflictMap;
  }

  const byWeekday = new Map<DayOfWeek, SolverEventInput[]>();
  for (const event of sortedEvents) {
    const list = byWeekday.get(event.dayOfWeek) ?? [];
    list.push(event);
    byWeekday.set(event.dayOfWeek, list);
  }

  for (const list of byWeekday.values()) {
    populateConflicts(list, rule.intervalCount, conflictMap);
  }

  return conflictMap;
}

/**
 * Builds a reusable, memoized interval-violation checker for a fixed set of
 * events and rules. Shared by the main solver engine and the group
 * pre-processing step so both apply the exact same 4.1 semantics against
 * their own independent assignment histories.
 */
export function createIntervalChecker(
  sortedEvents: SolverEventInput[],
  intervalRules: SolverIntervalRuleInput[],
): (
  history: Array<{ eventId: string; roleId: string }>,
  targetEventId: string,
  targetRoleId: string,
) => boolean {
  const conflictMapCache = new Map<string, Map<string, Set<string>>>();

  function getConflictMap(rule: SolverIntervalRuleInput): Map<string, Set<string>> {
    const key = `${rule.roleId ?? 'GENERAL'}::${rule.countMode}::${rule.intervalCount}`;
    let map = conflictMapCache.get(key);
    if (!map) {
      map = buildIntervalConflictMap(sortedEvents, rule);
      conflictMapCache.set(key, map);
    }
    return map;
  }

  return function violatesInterval(history, targetEventId, targetRoleId) {
    const rule = resolveIntervalRule(targetRoleId, intervalRules);
    if (!rule || rule.intervalCount <= 0) return false;

    const conflictMap = getConflictMap(rule);
    const conflictEvents = conflictMap.get(targetEventId) ?? new Set<string>();
    const scopedHistory = rule.roleId ? history.filter((h) => h.roleId === rule.roleId) : history;

    return scopedHistory.some((h) => conflictEvents.has(h.eventId));
  };
}

function populateConflicts(
  sequence: SolverEventInput[],
  intervalCount: number,
  conflictMap: Map<string, Set<string>>,
): void {
  for (let i = 0; i < sequence.length; i += 1) {
    const conflicts = conflictMap.get(sequence[i].id) ?? new Set<string>();
    for (let offset = 1; offset <= intervalCount; offset += 1) {
      if (sequence[i + offset]) conflicts.add(sequence[i + offset].id);
      if (sequence[i - offset]) conflicts.add(sequence[i - offset].id);
    }
    conflictMap.set(sequence[i].id, conflicts);
  }
}
