import { ScheduleAdminPageClient } from '@/components/scheduling/schedule-admin-page-client';
import { getAdminSchedulePageData } from '@/modules/scheduling/actions';

type PageProps = {
  searchParams: Promise<{ year?: string; month?: string }>;
};

export default async function AdminSchedulePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year ?? now.getUTCFullYear());
  const month = Number(params.month ?? now.getUTCMonth() + 1);

  const data = await getAdminSchedulePageData(year, month);

  return (
    <ScheduleAdminPageClient
      organizationId={data.session.organizationId}
      initialYear={year}
      initialMonth={month}
      serverOverview={data.overview}
      shortagePreview={data.shortagePreview}
      assignmentCandidates={data.assignmentCandidates}
    />
  );
}
