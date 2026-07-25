import type { DayOfWeek } from '@/generated/prisma/client';
import type { SolverEventInput, SolverIntervalRuleInput } from './solver.types';

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
 * Builds a reusable, lazily-built interval-violation checker for a fixed set of
 * events and the organization's interval rule. Shared by the main solver engine
 * and the group pre-processing step so both apply the exact same 4.1 semantics
 * against their own independent assignment histories.
 */
export function createIntervalChecker(
  sortedEvents: SolverEventInput[],
  intervalRule: SolverIntervalRuleInput | null,
): (history: Array<{ eventId: string; roleId: string }>, targetEventId: string) => boolean {
  const inactive = !intervalRule || intervalRule.intervalCount <= 0;
  let conflictMap: Map<string, Set<string>> | null = null;

  return function violatesInterval(history, targetEventId) {
    if (inactive) return false;

    conflictMap ??= buildIntervalConflictMap(sortedEvents, intervalRule!);
    const conflictEvents = conflictMap.get(targetEventId) ?? new Set<string>();

    return history.some((entry) => conflictEvents.has(entry.eventId));
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
