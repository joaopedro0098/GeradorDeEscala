import { ScheduleMemberPageClient } from '@/components/scheduling/schedule-member-page-client';
import { getMemberSchedulePageData } from '@/modules/scheduling/actions';

type PageProps = {
  searchParams: Promise<{ year?: string; month?: string; date?: string }>;
};

export default async function MemberSchedulePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const requested =
    params.year && params.month
      ? { year: Number(params.year), month: Number(params.month) }
      : null;

  const data = await getMemberSchedulePageData(requested);

  return (
    <ScheduleMemberPageClient
      organizationId={data.session.organizationId}
      workingMonth={data.workingMonth}
      viewedMonth={data.viewedMonth}
      isHistory={data.isHistory}
      historyMonths={data.historyMonths}
      initialSelectedDate={params.date ?? null}
      serverOverview={data.overview}
    />
  );
}
