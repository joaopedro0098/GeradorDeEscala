import { ScheduleAdminPageClient } from '@/components/scheduling/schedule-admin-page-client';
import { getAdminSchedulePageData } from '@/modules/scheduling/actions';

type PageProps = {
  searchParams: Promise<{ year?: string; month?: string }>;
};

export default async function AdminSchedulePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const requested =
    params.year && params.month
      ? { year: Number(params.year), month: Number(params.month) }
      : null;

  const data = await getAdminSchedulePageData(requested);

  return (
    <ScheduleAdminPageClient
      organizationId={data.session.organizationId}
      workingMonth={data.workingMonth}
      viewedMonth={data.viewedMonth}
      isHistory={data.isHistory}
      historyMonths={data.historyMonths}
      serverOverview={data.overview}
      shortagePreview={data.shortagePreview}
      assignmentCandidates={data.assignmentCandidates}
    />
  );
}
