import { ScheduleMemberView } from '@/components/scheduling/schedule-member-view';
import { getMemberSchedulePageData } from '@/modules/scheduling/actions';

type PageProps = {
  searchParams: Promise<{ year?: string; month?: string }>;
};

export default async function MemberSchedulePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year ?? now.getUTCFullYear());
  const month = Number(params.month ?? now.getUTCMonth() + 1);

  const data = await getMemberSchedulePageData(year, month);

  return <ScheduleMemberView initialYear={year} initialMonth={month} overview={data.overview} />;
}
