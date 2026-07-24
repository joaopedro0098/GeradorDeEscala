import { redirect } from 'next/navigation';
import { AccountSettingsForms } from '@/components/account/account-settings-forms';
import { getAccountPageData } from '@/modules/auth/actions';

export default async function MemberAccountPage() {
  const data = await getAccountPageData();
  if (!data) redirect('/login');

  return <AccountSettingsForms email={data.user.email} />;
}
