import { ScheduleAdminView } from '@/components/scheduling/schedule-admin-view';
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
    <ScheduleAdminView
      initialYear={year}
      initialMonth={month}
      overview={data.overview}
      shortagePreview={data.shortagePreview}
    />
  );
}
