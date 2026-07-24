import { redirect } from 'next/navigation';
import { AccountPlansSection } from '@/components/account/account-plans-section';
import { AccountSettingsForms } from '@/components/account/account-settings-forms';
import { OrganizationProfileForm } from '@/components/account/organization-profile-form';
import { getAccountPageData } from '@/modules/auth/actions';
import { canViewPlans } from '@/modules/auth/permissions';

export default async function AdminAccountPage() {
  const data = await getAccountPageData();
  if (!data) redirect('/login');

  const showPlans = data.session ? canViewPlans(data.session) : false;

  return (
    <div className="space-y-6">
      {data.canEditProfile && data.organization ? (
        <OrganizationProfileForm
          organizationName={data.organization.name}
          logoUrl={data.organization.logoUrl}
        />
      ) : null}
      <AccountSettingsForms email={data.user.email} />
      {showPlans && data.organization ? <AccountPlansSection organization={data.organization} /> : null}
    </div>
  );
}
