import { redirect } from 'next/navigation';
import { AccountPlansSection } from '@/components/account/account-plans-section';
import { AccountSettingsForms } from '@/components/account/account-settings-forms';
import { getAccountPageData } from '@/modules/auth/actions';
import { canViewPlans } from '@/modules/auth/permissions';

export default async function AdminAccountPage() {
  const data = await getAccountPageData();
  if (!data) redirect('/login');

  const showPlans = data.session ? canViewPlans(data.session) : false;

  return (
    <div className="space-y-6">
      <AccountSettingsForms email={data.user.email} />
      {showPlans && data.organization ? <AccountPlansSection organization={data.organization} /> : null}
    </div>
  );
}
