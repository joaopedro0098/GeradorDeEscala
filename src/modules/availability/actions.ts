'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth.server';
import { canManageMembers } from '@/modules/auth/permissions';
import {
  countMemberMarkedDaysInMonth,
  getMemberAvailabilitySubmissionPreview,
  getMinimumParticipationDays,
  listMemberAvailabilityEventIds,
  listMemberParticipationSummaries,
  listOrganizationEventsForMonth,
  toggleMemberAvailability,
} from '@/modules/availability/availability.service';

const MEMBER_PATH = '/membro/disponibilidade';
const ADMIN_PATH = '/admin/disponibilidade';

function revalidateAvailability(year: number, month: number) {
  revalidatePath(MEMBER_PATH);
  revalidatePath(`${MEMBER_PATH}?year=${year}&month=${month}`);
  revalidatePath(ADMIN_PATH);
  revalidatePath(`${ADMIN_PATH}?year=${year}&month=${month}`);
}

export async function getMemberAvailabilityPageData(year: number, month: number) {
  const session = await requireSession({ loginMode: 'user' });
  const [events, minimumDays] = await Promise.all([
    listOrganizationEventsForMonth(session.organizationId, year, month),
    getMinimumParticipationDays(session.organizationId),
  ]);

  const markedEventIds = await listMemberAvailabilityEventIds(
    session.membershipId,
    events.map((event) => event.id),
  );

  const selectedDays = markedEventIds.length;

  return {
    session,
    events,
    markedEventIds,
    minimumDays,
    selectedDays,
    year,
    month,
  };
}

export async function toggleAvailabilityAction(eventId: string, year: number, month: number) {
  const session = await requireSession({ loginMode: 'user' });
  await toggleMemberAvailability({
    membershipId: session.membershipId,
    organizationId: session.organizationId,
    eventId,
  });
  revalidateAvailability(year, month);
}

export async function getSubmitAvailabilityPreviewAction(year: number, month: number) {
  const session = await requireSession({ loginMode: 'user' });
  return getMemberAvailabilitySubmissionPreview({
    membershipId: session.membershipId,
    organizationId: session.organizationId,
    year,
    month,
  });
}

export async function submitAvailabilityAction(year: number, month: number) {
  const session = await requireSession({ loginMode: 'user' });
  const preview = await getMemberAvailabilitySubmissionPreview({
    membershipId: session.membershipId,
    organizationId: session.organizationId,
    year,
    month,
  });

  revalidateAvailability(year, month);

  return {
    success: true as const,
    message:
      preview.kind === 'below_minimum'
        ? 'Disponibilidade enviada mesmo abaixo do mínimo configurado.'
        : 'Disponibilidade enviada com sucesso.',
    preview,
  };
}

export async function getAdminParticipationPageData(year: number, month: number) {
  const session = await requireSession({ loginMode: 'admin' });
  if (!canManageMembers(session)) {
    return null;
  }

  const summaries = await listMemberParticipationSummaries(session.organizationId, year, month);
  const minimumDays = await getMinimumParticipationDays(session.organizationId);

  return {
    session,
    summaries,
    minimumDays,
    year,
    month,
  };
}

export async function getMemberMarkedDaysForMonth(
  membershipId: string,
  organizationId: string,
  year: number,
  month: number,
) {
  return countMemberMarkedDaysInMonth(membershipId, organizationId, year, month);
}
