'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { isDeveloperEmail } from '@/lib/developer';
import { prisma } from '@/lib/prisma';
import { getSessionFromCookies } from '@/modules/auth/session';
import {
  DevSimulateAvailabilityError,
  getDevAssignmentMatrix,
  listActiveMembersForDev,
  replaceAvailabilitiesForWorkingMonth,
  type DevActiveMember,
  type DevAssignmentMatrix,
} from '@/modules/dev/simulate-availability.service';
import { listOrganizationEventsForMonth } from '@/modules/availability/availability.service';
import { ensureWorkingMonth } from '@/modules/scheduling/working-month.service';
import type { YearMonth } from '@/modules/scheduling/working-month.logic';

export type DevActionState = {
  error?: string;
  success?: string;
};

async function assertDeveloperSession() {
  const session = await getSessionFromCookies();
  if (!session || session.loginMode !== 'admin') {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });

  if (!isDeveloperEmail(user?.email)) {
    return null;
  }

  return session;
}

function mapError(error: unknown): DevActionState {
  if (error instanceof DevSimulateAvailabilityError) {
    return { error: error.message };
  }
  if (error instanceof z.ZodError) {
    return { error: error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  return { error: 'Não foi possível salvar a simulação.' };
}

function revalidateDevPaths() {
  revalidatePath('/admin/dev/membros-teste');
  revalidatePath('/admin/disponibilidade');
  revalidatePath('/membro/disponibilidade');
  revalidatePath('/admin/escala');
}

export type DevSimulationPageData = {
  organizationName: string;
  workingMonth: YearMonth;
  cultEventCount: number;
  members: DevActiveMember[];
  matrix: DevAssignmentMatrix;
};

export async function getDevSimulationPageData(): Promise<DevSimulationPageData | null> {
  const session = await assertDeveloperSession();
  if (!session) return null;

  const workingMonth = await ensureWorkingMonth(session.organizationId);
  const [members, events, matrix] = await Promise.all([
    listActiveMembersForDev(session.organizationId),
    listOrganizationEventsForMonth(
      session.organizationId,
      workingMonth.year,
      workingMonth.month,
    ),
    getDevAssignmentMatrix(session.organizationId, workingMonth),
  ]);

  return {
    organizationName: session.organizationName,
    workingMonth,
    cultEventCount: events.length,
    members,
    matrix,
  };
}

export async function saveGeneralSimulatedAvailabilityAction(
  _prev: DevActionState,
  formData: FormData,
): Promise<DevActionState> {
  try {
    const session = await assertDeveloperSession();
    if (!session) {
      return { error: 'Acesso restrito ao desenvolvedor.' };
    }

    const dayCount = z.coerce.number().int().min(0).parse(formData.get('dayCount'));
    const members = await listActiveMembersForDev(session.organizationId);
    if (members.length === 0) {
      return { error: 'Nenhum membro ativo na organização.' };
    }

    const result = await replaceAvailabilitiesForWorkingMonth({
      organizationId: session.organizationId,
      memberDayCounts: members.map((member) => ({
        membershipId: member.membershipId,
        dayCount,
      })),
    });

    revalidateDevPaths();
    return {
      success: `Disponibilidade geral salva: ${dayCount} dia(s) para ${result.memberCount} membro(s) em ${result.year}-${String(result.month).padStart(2, '0')} (${result.eventCount} culto(s) no calendário).`,
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function saveIndividualSimulatedAvailabilityAction(
  _prev: DevActionState,
  formData: FormData,
): Promise<DevActionState> {
  try {
    const session = await assertDeveloperSession();
    if (!session) {
      return { error: 'Acesso restrito ao desenvolvedor.' };
    }

    const members = await listActiveMembersForDev(session.organizationId);
    if (members.length === 0) {
      return { error: 'Nenhum membro ativo na organização.' };
    }

    const memberDayCounts = members.map((member) => {
      const raw = formData.get(`days_${member.membershipId}`);
      const dayCount = z.coerce.number().int().min(0).parse(raw ?? 0);
      return { membershipId: member.membershipId, dayCount };
    });

    const result = await replaceAvailabilitiesForWorkingMonth({
      organizationId: session.organizationId,
      memberDayCounts,
    });

    revalidateDevPaths();
    return {
      success: `Disponibilidade individual salva para ${result.memberCount} membro(s) em ${result.year}-${String(result.month).padStart(2, '0')}.`,
    };
  } catch (error) {
    return mapError(error);
  }
}
