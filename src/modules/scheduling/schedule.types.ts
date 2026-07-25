import type { DayOfWeek } from '@/generated/prisma/client';
import type { SolverStatus } from './solver.types';

export type ScheduleSlotView = {
  id: string;
  roleId: string;
  roleName: string;
  slotIndex: number;
  membershipId: string | null;
  memberName: string | null;
  isManual: boolean;
  isMinister: boolean;
};

export type ScheduleEventView = {
  eventId: string;
  date: string;
  dayOfWeek: DayOfWeek;
  slots: ScheduleSlotView[];
};

export type MemberAssignmentCount = {
  membershipId: string;
  memberName: string;
  total: number;
  byRole: Array<{ roleId: string; roleName: string; count: number }>;
};

export type ScheduleAssignmentCandidate = {
  membershipId: string;
  memberName: string;
  availableEventIds: string[];
  roleIds: string[];
};

export type ScheduleOverview = {
  scheduleId: string;
  year: number;
  month: number;
  status: 'DRAFT' | 'PUBLISHED';
  generationStatus: SolverStatus | null;
  hasPublishedGaps: boolean;
  publishedAt: string | null;
  hasPendingDraft: boolean;
  hasPreviousVersion: boolean;
  hasManualSlots: boolean;
  /** When true, members cannot change availability for this month. */
  availabilityLocked: boolean;
  memberVisiblePublishedAt: string | null;
  events: ScheduleEventView[];
  memberCounts: MemberAssignmentCount[];
};

export type ShortageEntryView = {
  eventId: string;
  eventDate: string;
  roleId: string;
  roleName: string;
  quantityNeeded: number;
  availableCandidates: number;
  missing: number;
};

export const GENERATION_STATUS_LABELS: Record<SolverStatus, string> = {
  COMPLETE: 'Escala completa: todas as vagas foram preenchidas.',
  INCOMPLETE_BY_SHORTAGE:
    'Não há pessoas suficientes disponíveis para preencher todas as vagas deste período.',
  INCOMPLETE_BY_TIMEOUT:
    'O motor de geração não teve tempo suficiente para encontrar a melhor solução. Pode haver vagas em aberto mesmo havendo gente disponível — considere gerar novamente.',
};
