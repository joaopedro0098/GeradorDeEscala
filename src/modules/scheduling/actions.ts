'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { DayOfWeek } from '@/generated/prisma/client';
import { requireSession } from '@/lib/auth.server';
import { prisma } from '@/lib/prisma';
import { canManageMembers } from '@/modules/auth/permissions';
import { canGenerateScheduleForOrganization } from '@/modules/organizations/subscription.logic';
import {
  addPriorityRole,
  ConfigurationServiceError,
  createRole,
  deleteRole,
  getScheduleConfiguration,
  movePriorityRole,
  removePriorityRole,
  setParticipationMinimum,
  setPriorityRoleOrder,
  toggleEventDate,
  upsertDayRequirement,
  upsertDayRequirementsForDay,
} from '@/modules/scheduling/configuration.service';
import {
  generateSchedule,
  getAvailabilityLocked,
  getAssignmentCandidatesForAdmin,
  getPreGenerationShortagePreview,
  getScheduleOverviewForAdmin,
  getScheduleOverviewForMember,
  publishSchedule,
  ScheduleServiceError,
  setAvailabilityLocked,
  setScheduleSlotAssignment,
  setScheduleSlotMinister,
  undoLastGeneration,
} from '@/modules/scheduling/schedule.service';
import type { SolverStatus } from '@/modules/scheduling/solver.types';
import {
  ensureWorkingMonth,
  getWorkingMonth,
  setWorkingMonth,
} from '@/modules/scheduling/working-month.service';
import {
  currentYearMonth,
  isSameYearMonth,
  isValidYearMonth,
  isWithinHistoryRange,
  listHistoryMonths,
  type YearMonth,
} from '@/modules/scheduling/working-month.logic';

const CONFIG_PATH = '/admin/configuracoes';
const SCHEDULE_ADMIN_PATH = '/admin/escala';
const SCHEDULE_MEMBER_PATH = '/membro/escala';
const AVAILABILITY_ADMIN_PATH = '/admin/disponibilidade';
const AVAILABILITY_MEMBER_PATH = '/membro/disponibilidade';

function revalidateConfiguration() {
  revalidatePath(CONFIG_PATH);
}

/** The working month drives every screen, so all of them go stale together. */
function revalidateWorkingMonth() {
  revalidatePath(CONFIG_PATH);
  revalidatePath(SCHEDULE_ADMIN_PATH);
  revalidatePath(SCHEDULE_MEMBER_PATH);
  revalidatePath(AVAILABILITY_ADMIN_PATH);
  revalidatePath(AVAILABILITY_MEMBER_PATH);
}

function revalidateSchedule(year: number, month: number) {
  revalidatePath(SCHEDULE_ADMIN_PATH);
  revalidatePath(`${SCHEDULE_ADMIN_PATH}?year=${year}&month=${month}`);
  revalidatePath(SCHEDULE_MEMBER_PATH);
  revalidatePath(`${SCHEDULE_MEMBER_PATH}?year=${year}&month=${month}`);
}

async function requireAdminSession() {
  const session = await requireSession({ loginMode: 'admin' });
  if (!canManageMembers(session)) {
    throw new ConfigurationServiceError('Sem permissão para configurar a escala.');
  }
  return session;
}

function mapError(error: unknown): { error: string } {
  if (error instanceof ConfigurationServiceError || error instanceof ScheduleServiceError) {
    return { error: error.message };
  }
  if (error instanceof z.ZodError) {
    return { error: error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  return { error: 'Não foi possível salvar a configuração.' };
}

export async function getConfigurationPageData() {
  const session = await requireSession({ loginMode: 'admin' });
  if (!canManageMembers(session)) {
    redirect('/admin/escala');
  }
  const workingMonth = await ensureWorkingMonth(session.organizationId);
  const configuration = await getScheduleConfiguration(session.organizationId);
  return {
    session,
    configuration,
    workingMonth,
    earliestMonth: currentYearMonth(new Date()),
  };
}

export async function setWorkingMonthAction(
  year: number,
  month: number,
): Promise<{ error?: string }> {
  try {
    const session = await requireAdminSession();
    await setWorkingMonth(session.organizationId, { year, month });
    revalidateWorkingMonth();
    return {};
  } catch (error) {
    return mapError(error);
  }
}

export async function toggleEventDateAction(dateKey: string): Promise<void> {
  try {
    const session = await requireAdminSession();
    const workingMonth = await getWorkingMonth(session.organizationId);
    const monthPrefix = `${workingMonth.year}-${String(workingMonth.month).padStart(2, '0')}-`;
    if (!dateKey.startsWith(monthPrefix)) {
      throw new ConfigurationServiceError('Só é possível marcar dias do mês de trabalho.');
    }
    await toggleEventDate(session.organizationId, dateKey);
    revalidateWorkingMonth();
  } catch (error) {
    console.error(mapError(error).error);
  }
}

export async function createRoleAction(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  try {
    const session = await requireAdminSession();
    const name = z.string().trim().min(1, 'Informe o nome da função.').parse(formData.get('name'));
    await createRole(session.organizationId, name);
    revalidateConfiguration();
    return { success: 'Função adicionada.' };
  } catch (error) {
    return mapError(error);
  }
}

export async function deleteRoleAction(roleId: string): Promise<void> {
  try {
    const session = await requireAdminSession();
    await deleteRole(session.organizationId, roleId);
    revalidateConfiguration();
  } catch (error) {
    console.error(mapError(error).error);
  }
}

export async function saveDayFormationAction(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  try {
    const session = await requireAdminSession();
    const dayOfWeek = z
      .enum(['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'])
      .parse(formData.get('dayOfWeek'));

    const roleIds = formData.getAll('roleId').map(String);
    const requirements = roleIds.map((roleId) => ({
      roleId,
      quantity: z.coerce.number().int().min(0).parse(formData.get(`quantity_${roleId}`)),
    }));

    await upsertDayRequirementsForDay({
      organizationId: session.organizationId,
      dayOfWeek: dayOfWeek as DayOfWeek,
      requirements,
    });
    revalidateConfiguration();
    return { success: 'Formação salva.' };
  } catch (error) {
    return mapError(error);
  }
}

export async function saveDayRoleQuantityAction(
  dayOfWeek: DayOfWeek,
  roleId: string,
  quantity: number,
): Promise<{ error?: string }> {
  try {
    const session = await requireAdminSession();
    const parsedQuantity = z.coerce.number().int().min(0).parse(quantity);
    await upsertDayRequirement({
      organizationId: session.organizationId,
      dayOfWeek,
      roleId,
      quantity: parsedQuantity,
    });
    revalidateConfiguration();
    return {};
  } catch (error) {
    return mapError(error);
  }
}

export async function addPriorityRoleAction(roleId: string): Promise<void> {
  try {
    const session = await requireAdminSession();
    await addPriorityRole(session.organizationId, roleId);
    revalidateConfiguration();
  } catch (error) {
    console.error(mapError(error).error);
  }
}

export async function removePriorityRoleAction(roleId: string): Promise<void> {
  try {
    const session = await requireAdminSession();
    await removePriorityRole(session.organizationId, roleId);
    revalidateConfiguration();
  } catch (error) {
    console.error(mapError(error).error);
  }
}

export async function movePriorityRoleAction(
  roleId: string,
  direction: 'up' | 'down',
): Promise<void> {
  try {
    const session = await requireAdminSession();
    await movePriorityRole({
      organizationId: session.organizationId,
      roleId,
      direction,
    });
    revalidateConfiguration();
  } catch (error) {
    console.error(mapError(error).error);
  }
}

export async function setPriorityRoleOrderAction(orderedRoleIds: string[]): Promise<{ error?: string }> {
  try {
    const session = await requireAdminSession();
    const ids = z.array(z.string().min(1)).min(1).parse(orderedRoleIds);
    await setPriorityRoleOrder(session.organizationId, ids);
    revalidateConfiguration();
    return {};
  } catch (error) {
    return mapError(error);
  }
}

export async function saveParticipationMinimumAction(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  try {
    const session = await requireAdminSession();
    const minimumDays = z.coerce
      .number()
      .int()
      .min(0, 'Informe um número válido.')
      .parse(formData.get('minimumDays'));

    await setParticipationMinimum({
      organizationId: session.organizationId,
      minimumDays,
    });
    revalidateConfiguration();
    return { success: 'Mínimo de participação salvo.' };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * The working month is the only editable period; anything older is opened as a
 * read-only history view, and anything else falls back to the working month.
 */
function resolveViewedMonth(
  workingMonth: YearMonth,
  requested: YearMonth | null,
): { viewedMonth: YearMonth; isHistory: boolean } {
  if (!requested || !isValidYearMonth(requested) || isSameYearMonth(requested, workingMonth)) {
    return { viewedMonth: workingMonth, isHistory: false };
  }
  if (isWithinHistoryRange(requested, workingMonth)) {
    return { viewedMonth: requested, isHistory: true };
  }
  return { viewedMonth: workingMonth, isHistory: false };
}

export async function getAdminSchedulePageData(requested: YearMonth | null) {
  const session = await requireSession({ loginMode: 'admin' });
  if (!canManageMembers(session)) {
    redirect('/admin/escala');
  }

  const workingMonth = await ensureWorkingMonth(session.organizationId);
  const { viewedMonth, isHistory } = resolveViewedMonth(workingMonth, requested);

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
    select: { subscriptionStatus: true, trialStartedAt: true },
  });

  const subscriptionCheck = canGenerateScheduleForOrganization(organization);

  const [overview, shortagePreview, assignmentCandidates, availabilityLocked] = await Promise.all([
    getScheduleOverviewForAdmin(session.organizationId, viewedMonth.year, viewedMonth.month),
    isHistory
      ? Promise.resolve([])
      : getPreGenerationShortagePreview(session.organizationId, viewedMonth.year, viewedMonth.month),
    isHistory
      ? Promise.resolve([])
      : getAssignmentCandidatesForAdmin(session.organizationId, viewedMonth.year, viewedMonth.month),
    getAvailabilityLocked(session.organizationId, viewedMonth.year, viewedMonth.month),
  ]);

  return {
    session,
    overview,
    shortagePreview,
    assignmentCandidates,
    availabilityLocked: overview?.availabilityLocked ?? availabilityLocked,
    workingMonth,
    viewedMonth,
    isHistory,
    historyMonths: listHistoryMonths(workingMonth),
    generateSubscriptionNotice: subscriptionCheck.allowed ? null : subscriptionCheck.reason ?? null,
  };
}

export async function getMemberSchedulePageData(requested: YearMonth | null) {
  const session = await requireSession({ loginMode: 'user' });
  const workingMonth = await ensureWorkingMonth(session.organizationId);
  const { viewedMonth, isHistory } = resolveViewedMonth(workingMonth, requested);
  const overview = await getScheduleOverviewForMember(
    session.organizationId,
    viewedMonth.year,
    viewedMonth.month,
  );

  return {
    session,
    overview,
    workingMonth,
    viewedMonth,
    isHistory,
    historyMonths: listHistoryMonths(workingMonth),
  };
}

export async function generateScheduleAction(
  keepManual = false,
): Promise<{ error?: string; success?: string; status?: SolverStatus; blankCount?: number }> {
  try {
    const session = await requireAdminSession();
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: session.organizationId },
      select: { subscriptionStatus: true, trialStartedAt: true },
    });
    const subscriptionCheck = canGenerateScheduleForOrganization(organization);
    if (!subscriptionCheck.allowed) {
      return { error: subscriptionCheck.reason };
    }

    const { year, month } = await getWorkingMonth(session.organizationId);
    const result = await generateSchedule(session.organizationId, year, month, { keepManual });
    revalidateSchedule(year, month);
    return { success: 'Escala gerada.', status: result.status, blankCount: result.blankCount };
  } catch (error) {
    return mapError(error);
  }
}

export async function publishScheduleAction(): Promise<{ error?: string; success?: string }> {
  try {
    const session = await requireAdminSession();
    const { year, month } = await getWorkingMonth(session.organizationId);
    await publishSchedule(session.organizationId, year, month);
    revalidateSchedule(year, month);
    return { success: 'Escala publicada.' };
  } catch (error) {
    return mapError(error);
  }
}

export async function setAvailabilityLockedAction(
  availabilityLocked: boolean,
): Promise<{ error?: string; success?: string }> {
  try {
    const session = await requireAdminSession();
    const { year, month } = await getWorkingMonth(session.organizationId);
    await setAvailabilityLocked(session.organizationId, year, month, availabilityLocked);
    revalidateSchedule(year, month);
    revalidatePath('/membro/disponibilidade');
    revalidatePath('/admin/disponibilidade');
    return { success: 'Salvo com sucesso' };
  } catch (error) {
    return mapError(error);
  }
}

export async function setScheduleSlotMinisterAction(
  scheduleSlotId: string,
): Promise<{ error?: string }> {
  try {
    const session = await requireAdminSession();
    await setScheduleSlotMinister(session.organizationId, scheduleSlotId);
    const { year, month } = await getWorkingMonth(session.organizationId);
    revalidateSchedule(year, month);
    return {};
  } catch (error) {
    return mapError(error);
  }
}

export async function setScheduleSlotAssignmentAction(
  scheduleSlotId: string,
  membershipId: string | null,
): Promise<{ error?: string }> {
  try {
    const session = await requireAdminSession();
    await setScheduleSlotAssignment(session.organizationId, scheduleSlotId, membershipId);
    const { year, month } = await getWorkingMonth(session.organizationId);
    revalidateSchedule(year, month);
    return {};
  } catch (error) {
    return mapError(error);
  }
}

export async function undoLastGenerationAction(): Promise<{ error?: string; success?: string }> {
  try {
    const session = await requireAdminSession();
    const { year, month } = await getWorkingMonth(session.organizationId);
    await undoLastGeneration(session.organizationId, year, month);
    revalidateSchedule(year, month);
    return { success: 'Última geração desfeita.' };
  } catch (error) {
    return mapError(error);
  }
}
