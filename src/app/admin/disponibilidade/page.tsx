import { redirect } from 'next/navigation';
import { AdminParticipationLegend } from '@/components/availability/admin-participation-legend';
import { getAdminParticipationPageData } from '@/modules/availability/actions';

export default async function AdminParticipationPage() {
  const data = await getAdminParticipationPageData();
  if (!data) redirect('/login');

  return (
    <AdminParticipationLegend
      workingMonth={data.workingMonth}
      minimumDays={data.minimumDays}
      summaries={data.summaries}
    />
  );
}
