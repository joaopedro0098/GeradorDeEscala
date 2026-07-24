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

export type SolverRoleCombinationInput = {
  roleAId: string;
  roleBId: string;
};

export type SolverMemberInput = {
  membershipId: string;
  availableEventIds: string[];
  rolePreferences: SolverRolePreferenceInput[];
  /**
   * Pairs of roles this member has explicitly marked as safe to accumulate
   * simultaneously in the same event (e.g. "guitar + vocals"). Used only as
   * a scarcity fallback in the solver — never the preferred outcome.
   */
  compatibleRolePairs?: SolverRoleCombinationInput[];
};

export type SolverIntervalRuleInput = {
  /** null represents the organization-wide (GENERAL) rule. */
  roleId: string | null;
  intervalCount: number;
  countMode: 'BY_EVENT' | 'BY_DAY_OF_WEEK';
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

export type SolverGroupMode = 'FLEXIBLE' | 'STRICT';

export type SolverGroupInput = {
  groupId: string;
  mode: SolverGroupMode;
  /**
   * Members of the group. A membership can belong to at most one group
   * (enforced by a unique constraint on GroupMembership.membershipId), so
   * groups never overlap.
   */
  membershipIds: string[];
};

export type SolverInput = {
  events: SolverEventInput[];
  requirements: SolverRequirementInput[];
  members: SolverMemberInput[];
  intervalRules: SolverIntervalRuleInput[];
  priorityRoles: SolverPriorityRoleInput[];
  priorMonthAssignments?: SolverPriorMonthAssignmentInput[];
  groups?: SolverGroupInput[];
  /** Anytime search budget in milliseconds. Defaults to 8000ms. */
  timeoutMs?: number;
  /** Injectable clock, primarily for deterministic tests. */
  now?: () => number;
};

export type SolverAssignedSlot = {
  eventId: string;
  roleId: string;
  slotIndex: number;
  membershipId: string | null;
  /** True when this slot was filled by relaxing the interval rule for a high-priority role (4.2). */
  filledByPriorityOverride: boolean;
  /** True when this slot was filled by accumulating a role onto a person already serving elsewhere in the same event. */
  filledByRoleStacking: boolean;
  /** True when this slot was pre-assigned by a STRICT member group match, before the general search ran. */
  filledByGroupPin: boolean;
};

export type SolverStatus = 'COMPLETE' | 'INCOMPLETE_BY_SHORTAGE' | 'INCOMPLETE_BY_TIMEOUT';

export type SolverResult = {
  status: SolverStatus;
  slots: SolverAssignedSlot[];
  unfilledSlots: Array<{ eventId: string; roleId: string; slotIndex: number }>;
};
