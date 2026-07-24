'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { DayOfWeek, IntervalCountMode } from '@/generated/prisma/client';
import { requireSession } from '@/lib/auth.server';
import { canManageMembers } from '@/modules/auth/permissions';
import {
  addPriorityRole,
  ConfigurationServiceError,
  createRole,
  deleteRole,
  getScheduleConfiguration,
  movePriorityRole,
  removeIntervalRule,
  removePriorityRole,
  setParticipationMinimum,
  toggleEventDate,
  upsertDayRequirement,
  upsertIntervalRule,
} from '@/modules/scheduling/configuration.service';
import {
  generateSchedule,
  getAssignmentCandidatesForAdmin,
  getPreGenerationShortagePreview,
  getScheduleOverviewForAdmin,
  getScheduleOverviewForMember,
  publishSchedule,
  ScheduleServiceError,
  setScheduleSlotAssignment,
  setScheduleSlotMinister,
  undoLastGeneration,
} from '@/modules/scheduling/schedule.service';
import type { SolverStatus } from '@/modules/scheduling/solver.types';

const CONFIG_PATH = '/admin/configuracoes';
const SCHEDULE_ADMIN_PATH = '/admin/escala';
const SCHEDULE_MEMBER_PATH = '/membro/escala';

function revalidateConfiguration() {
  revalidatePath(CONFIG_PATH);
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
    redirect('/admin');
  }
  const configuration = await getScheduleConfiguration(session.organizationId);
  return { session, configuration };
}

export async function toggleEventDateAction(dateKey: string): Promise<void> {
  try {
    const session = await requireAdminSession();
    await toggleEventDate(session.organizationId, dateKey);
    revalidateConfiguration();
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

export async function saveDayRequirementAction(formData: FormData): Promise<void> {
  try {
    const session = await requireAdminSession();
    const parsed = z
      .object({
        dayOfWeek: z.enum([
          'SUNDAY',
          'MONDAY',
          'TUESDAY',
          'WEDNESDAY',
          'THURSDAY',
          'FRIDAY',
          'SATURDAY',
        ]),
        roleId: z.string().min(1),
        quantity: z.coerce.number().int().min(0),
      })
      .parse({
        dayOfWeek: formData.get('dayOfWeek'),
        roleId: formData.get('roleId'),
        quantity: formData.get('quantity'),
      });

    await upsertDayRequirement({
      organizationId: session.organizationId,
      dayOfWeek: parsed.dayOfWeek as DayOfWeek,
      roleId: parsed.roleId,
      quantity: parsed.quantity,
    });
    revalidateConfiguration();
  } catch (error) {
    console.error(mapError(error).error);
  }
}

export async function saveGeneralIntervalRuleAction(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  try {
    const session = await requireAdminSession();
    const parsed = z
      .object({
        intervalCount: z.coerce.number().int().min(0),
        countMode: z.enum(['BY_EVENT', 'BY_DAY_OF_WEEK']),
      })
      .parse({
        intervalCount: formData.get('intervalCount'),
        countMode: formData.get('countMode'),
      });

    await upsertIntervalRule({
      organizationId: session.organizationId,
      intervalCount: parsed.intervalCount,
      countMode: parsed.countMode as IntervalCountMode,
    });
    revalidateConfiguration();
    return { success: 'Regra geral de intervalo salva.' };
  } catch (error) {
    return mapError(error);
  }
}

export async function saveRoleIntervalRuleAction(formData: FormData): Promise<void> {
  try {
    const session = await requireAdminSession();
    const parsed = z
      .object({
        roleId: z.string().min(1),
        intervalCount: z.coerce.number().int().min(0),
        countMode: z.enum(['BY_EVENT', 'BY_DAY_OF_WEEK']),
      })
      .parse({
        roleId: formData.get('roleId'),
        intervalCount: formData.get('intervalCount'),
        countMode: formData.get('countMode'),
      });

    await upsertIntervalRule({
      organizationId: session.organizationId,
      roleId: parsed.roleId,
      intervalCount: parsed.intervalCount,
      countMode: parsed.countMode as IntervalCountMode,
    });
    revalidateConfiguration();
  } catch (error) {
    console.error(mapError(error).error);
  }
}

export async function removeRoleIntervalRuleAction(roleId: string): Promise<void> {
  try {
    const session = await requireAdminSession();
    await removeIntervalRule({ organizationId: session.organizationId, roleId });
    revalidateConfiguration();
  } catch (error) {
    console.error(mapError(error).error);
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

export async function getAdminSchedulePageData(year: number, month: number) {
  const session = await requireSession({ loginMode: 'admin' });
  if (!canManageMembers(session)) {
    redirect('/admin');
  }

  const [overview, shortagePreview, assignmentCandidates] = await Promise.all([
    getScheduleOverviewForAdmin(session.organizationId, year, month),
    getPreGenerationShortagePreview(session.organizationId, year, month),
    getAssignmentCandidatesForAdmin(session.organizationId, year, month),
  ]);

  return { session, overview, shortagePreview, assignmentCandidates, year, month };
}

export async function getMemberSchedulePageData(year: number, month: number) {
  const session = await requireSession({ loginMode: 'user' });
  const overview = await getScheduleOverviewForMember(session.organizationId, year, month);
  return { session, overview, year, month };
}

export async function generateScheduleAction(
  year: number,
  month: number,
  keepManual = false,
): Promise<{ error?: string; success?: string; status?: SolverStatus; blankCount?: number }> {
  try {
    const session = await requireAdminSession();
    const result = await generateSchedule(session.organizationId, year, month, { keepManual });
    revalidateSchedule(year, month);
    return { success: 'Escala gerada.', status: result.status, blankCount: result.blankCount };
  } catch (error) {
    return mapError(error);
  }
}

export async function publishScheduleAction(
  year: number,
  month: number,
): Promise<{ error?: string; success?: string }> {
  try {
    const session = await requireAdminSession();
    await publishSchedule(session.organizationId, year, month);
    revalidateSchedule(year, month);
    return { success: 'Escala publicada.' };
  } catch (error) {
    return mapError(error);
  }
}

export async function setScheduleSlotMinisterAction(
  scheduleSlotId: string,
  year: number,
  month: number,
): Promise<{ error?: string }> {
  try {
    const session = await requireAdminSession();
    await setScheduleSlotMinister(session.organizationId, scheduleSlotId);
    revalidateSchedule(year, month);
    return {};
  } catch (error) {
    return mapError(error);
  }
}

export async function setScheduleSlotAssignmentAction(
  scheduleSlotId: string,
  membershipId: string | null,
  year: number,
  month: number,
): Promise<{ error?: string }> {
  try {
    const session = await requireAdminSession();
    await setScheduleSlotAssignment(session.organizationId, scheduleSlotId, membershipId);
    revalidateSchedule(year, month);
    return {};
  } catch (error) {
    return mapError(error);
  }
}

export async function undoLastGenerationAction(
  year: number,
  month: number,
): Promise<{ error?: string; success?: string }> {
  try {
    const session = await requireAdminSession();
    await undoLastGeneration(session.organizationId, year, month);
    revalidateSchedule(year, month);
    return { success: 'Última geração desfeita.' };
  } catch (error) {
    return mapError(error);
  }
}
