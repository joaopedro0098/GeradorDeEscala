import type { DayOfWeek } from '@/generated/prisma/client';

export type SolverEventInput = {
  id: string;
  date: string;
  dayOfWeek: DayOfWeek;
};

export type SolverRequirementInput = {
  eventId: string;
  roleId: string;
  quantity: number;
};

export type SolverRolePreferenceInput = {
  roleId: string;
  sortOrder: number;
};

export type SolverMemberInput = {
  membershipId: string;
  availableEventIds: string[];
  rolePreferences: SolverRolePreferenceInput[];
};

export type SolverPriorityRoleInput = {
  roleId: string;
  sortOrder: number;
};

export type SolverPriorMonthAssignmentInput = {
  membershipId: string;
  roleId: string;
  count: number;
};

export type SolverRoleCatalogInput = {
  id: string;
  /** ISO timestamp; used to order roles that are not in PriorityRole. */
  createdAt: string;
};

/** Admin-locked slot preserved during partial regeneration (keep_manual). */
export type SolverPinnedSlotInput = {
  eventId: string;
  roleId: string;
  slotIndex: number;
  membershipId: string | null;
};

export type SolverInput = {
  events: SolverEventInput[];
  requirements: SolverRequirementInput[];
  members: SolverMemberInput[];
  priorityRoles: SolverPriorityRoleInput[];
  /** All org roles (for processing order after PriorityRole). */
  roles: SolverRoleCatalogInput[];
  priorMonthAssignments?: SolverPriorMonthAssignmentInput[];
  /** Manual assignments the solver must not change (keep_manual). */
  pinnedSlots?: SolverPinnedSlotInput[];
};

export type SolverAssignedSlot = {
  eventId: string;
  roleId: string;
  slotIndex: number;
  membershipId: string | null;
  /** True when this slot was locked by an admin manual assignment (keep_manual). */
  filledByManualPin: boolean;
};

export type SolverStatus = 'COMPLETE' | 'INCOMPLETE_BY_SHORTAGE' | 'INCOMPLETE_BY_TIMEOUT';

export type SolverResult = {
  status: SolverStatus;
  slots: SolverAssignedSlot[];
  unfilledSlots: Array<{ eventId: string; roleId: string; slotIndex: number }>;
};
