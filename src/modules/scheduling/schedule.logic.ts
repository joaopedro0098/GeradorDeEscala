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

/** True when at least one slot in the period has no one assigned. */
export function hasBlankSlots(slots: Array<{ membershipId: string | null }>): boolean {
  return slots.some((slot) => slot.membershipId === null);
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
