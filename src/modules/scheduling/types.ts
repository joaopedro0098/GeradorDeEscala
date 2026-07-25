import type { DayOfWeek } from '@/generated/prisma/client';

export const DAY_OF_WEEK_ORDER: DayOfWeek[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  SUNDAY: 'Domingo',
  MONDAY: 'Segunda-feira',
  TUESDAY: 'Terça-feira',
  WEDNESDAY: 'Quarta-feira',
  THURSDAY: 'Quinta-feira',
  FRIDAY: 'Sexta-feira',
  SATURDAY: 'Sábado',
};

export const INTERVAL_COUNT_MODE_LABELS = {
  BY_EVENT: 'Por evento',
  BY_DAY_OF_WEEK: 'Por dia da semana',
} as const;

export type RoleSummary = {
  id: string;
  name: string;
};

export type EventDateSummary = {
  id: string;
  date: string;
};

export type DayRequirementSummary = {
  dayOfWeek: DayOfWeek;
  roleId: string;
  roleName: string;
  quantity: number;
};

export type IntervalRuleSummary = {
  intervalCount: number;
  countMode: 'BY_EVENT' | 'BY_DAY_OF_WEEK';
};

export type PriorityRoleSummary = {
  roleId: string;
  roleName: string;
  sortOrder: number;
};

export type ScheduleConfigurationSnapshot = {
  roles: RoleSummary[];
  events: EventDateSummary[];
  dayRequirements: DayRequirementSummary[];
  generalIntervalRule: IntervalRuleSummary | null;
  priorityRoles: PriorityRoleSummary[];
  participationMinimumDays: number | null;
};
