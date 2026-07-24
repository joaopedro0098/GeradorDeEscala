import { ScheduleMemberPageClient } from '@/components/scheduling/schedule-member-page-client';
import { getMemberSchedulePageData } from '@/modules/scheduling/actions';

type PageProps = {
  searchParams: Promise<{ year?: string; month?: string; date?: string }>;
};

export default async function MemberSchedulePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year ?? now.getUTCFullYear());
  const month = Number(params.month ?? now.getUTCMonth() + 1);
  const selectedDate = params.date ?? null;

  const data = await getMemberSchedulePageData(year, month);

  return (
    <ScheduleMemberPageClient
      organizationId={data.session.organizationId}
      initialYear={year}
      initialMonth={month}
      initialSelectedDate={selectedDate}
      serverOverview={data.overview}
    />
  );
}
