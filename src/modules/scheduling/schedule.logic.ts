import type {
  MemberAssignmentCount,
  ScheduleEventView,
  ScheduleSlotView,
} from './schedule.types';

/**
 * Groups a flat list of slots (already joined with event/role/member data)
 * into one entry per event, sorted chronologically, with each event's own
 * slots sorted by role name then slot index for a stable, readable layout.
 */
export function groupSlotsByEvent(
  events: Array<{ eventId: string; date: string; dayOfWeek: ScheduleEventView['dayOfWeek'] }>,
  slots: Array<ScheduleSlotView & { eventId: string }>,
): ScheduleEventView[] {
  const slotsByEvent = new Map<string, ScheduleSlotView[]>();
  for (const slot of slots) {
    const list = slotsByEvent.get(slot.eventId) ?? [];
    list.push(slot);
    slotsByEvent.set(slot.eventId, list);
  }

  return [...events]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((event) => ({
      eventId: event.eventId,
      date: event.date,
      dayOfWeek: event.dayOfWeek,
      slots: (slotsByEvent.get(event.eventId) ?? []).sort((a, b) => {
        if (a.roleName !== b.roleName) return a.roleName.localeCompare(b.roleName);
        return a.slotIndex - b.slotIndex;
      }),
    }));
}

export type ScheduleMatrixColumn = { roleId: string; roleName: string };

export type ScheduleMatrixRow = {
  eventId: string;
  date: string;
  dayOfWeek: ScheduleEventView['dayOfWeek'];
  /** One entry per column, in the same order as `columns`. */
  cells: Array<{ roleId: string; slots: ScheduleSlotView[] }>;
};

export type ScheduleMatrix = {
  columns: ScheduleMatrixColumn[];
  rows: ScheduleMatrixRow[];
};

/**
 * Reshapes the per-event slot lists into a day × role grid: one row per event
 * (chronological) and one column per role used anywhere in the period, so a
 * role missing on a given day still lines up under its own column.
 */
export function buildScheduleMatrix(events: ScheduleEventView[]): ScheduleMatrix {
  const roleNameById = new Map<string, string>();
  for (const event of events) {
    for (const slot of event.slots) {
      roleNameById.set(slot.roleId, slot.roleName);
    }
  }

  const columns: ScheduleMatrixColumn[] = [...roleNameById.entries()]
    .map(([roleId, roleName]) => ({ roleId, roleName }))
    .sort((a, b) => {
      const aIsVoz = a.roleName.trim().toLowerCase() === 'voz' ? 0 : 1;
      const bIsVoz = b.roleName.trim().toLowerCase() === 'voz' ? 0 : 1;
      if (aIsVoz !== bIsVoz) return aIsVoz - bIsVoz;
      return a.roleName.localeCompare(b.roleName) || a.roleId.localeCompare(b.roleId);
    });

  const rows: ScheduleMatrixRow[] = [...events]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((event) => ({
      eventId: event.eventId,
      date: event.date,
      dayOfWeek: event.dayOfWeek,
      cells: columns.map((column) => ({
        roleId: column.roleId,
        slots: event.slots
          .filter((slot) => slot.roleId === column.roleId)
          .sort((a, b) => a.slotIndex - b.slotIndex),
      })),
    }));

  return { columns, rows };
}

/** True when at least one slot in the period has no one assigned. */
export function hasBlankSlots(slots: Array<{ membershipId: string | null }>): boolean {
  return slots.some((slot) => slot.membershipId === null);
}

/** Counts unfilled slots in a single event card. */
export function countBlankSlotsInEvent(event: ScheduleEventView): number {
  return event.slots.filter((slot) => slot.membershipId === null).length;
}

/** True when an event has at least one blank slot (lacuna). */
export function eventHasBlankSlots(event: ScheduleEventView): boolean {
  return hasBlankSlots(event.slots);
}

/** Total blank slots across all events in a member-visible overview. */
export function countBlankSlotsInOverview(events: ScheduleEventView[]): number {
  return events.reduce((total, event) => total + countBlankSlotsInEvent(event), 0);
}

/** Event dates (YYYY-MM-DD) that still have at least one blank slot. */
export function datesWithBlankSlots(events: ScheduleEventView[]): string[] {
  return events.filter(eventHasBlankSlots).map((event) => event.date);
}

/**
 * Counts, per member, how many slots they were assigned across the whole
 * period (total) and broken down by role — used by the admin-only,
 * collapsible "contagem de escalações" sub-section. Sorted by total
 * (descending) then name, so the busiest people surface first.
 */
export function countAssignmentsByMember(
  slots: Array<{
    membershipId: string | null;
    memberName: string | null;
    roleId: string;
    roleName: string;
  }>,
): MemberAssignmentCount[] {
  const countsByMember = new Map<string, MemberAssignmentCount>();

  for (const slot of slots) {
    if (!slot.membershipId || !slot.memberName) continue;

    let member = countsByMember.get(slot.membershipId);
    if (!member) {
      member = { membershipId: slot.membershipId, memberName: slot.memberName, total: 0, byRole: [] };
      countsByMember.set(slot.membershipId, member);
    }

    member.total += 1;
    const roleEntry = member.byRole.find((entry) => entry.roleId === slot.roleId);
    if (roleEntry) {
      roleEntry.count += 1;
    } else {
      member.byRole.push({ roleId: slot.roleId, roleName: slot.roleName, count: 1 });
    }
  }

  return [...countsByMember.values()]
    .map((member) => ({
      ...member,
      byRole: [...member.byRole].sort((a, b) => a.roleName.localeCompare(b.roleName)),
    }))
    .sort((a, b) => {
      if (a.total !== b.total) return b.total - a.total;
      return a.memberName.localeCompare(b.memberName);
    });
}

/**
 * Applies a "mark as minister" selection to the slots of a single event,
 * enforcing the confirmed exclusivity rule: at most one minister per event.
 * Selecting the slot that is already the minister toggles it back off;
 * selecting any other slot moves the flag to it. A blank slot (no one
 * assigned) can never become the minister.
 */
export function applyMinisterSelection<
  T extends { id: string; membershipId: string | null; isMinister: boolean },
>(eventSlots: T[], selectedSlotId: string): T[] {
  const target = eventSlots.find((slot) => slot.id === selectedSlotId);
  const wasAlreadyMinister = Boolean(target?.isMinister);

  return eventSlots.map((slot) => ({
    ...slot,
    isMinister: slot.id === selectedSlotId && slot.membershipId !== null && !wasAlreadyMinister,
  }));
}
