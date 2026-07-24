import { redirect } from 'next/navigation';
import { AdminParticipationLegend } from '@/components/availability/admin-participation-legend';
import { getAdminParticipationPageData } from '@/modules/availability/actions';

type PageProps = {
  searchParams: Promise<{ year?: string; month?: string }>;
};

export default async function AdminParticipationPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year ?? now.getUTCFullYear());
  const month = Number(params.month ?? now.getUTCMonth() + 1);

  const data = await getAdminParticipationPageData(year, month);
  if (!data) redirect('/login');

  return (
    <AdminParticipationLegend
      initialYear={year}
      initialMonth={month}
      minimumDays={data.minimumDays}
      summaries={data.summaries}
    />
  );
}
