import { redirect } from 'next/navigation';
import { OrganizationsPageClient } from '@/components/organizations/organizations-page-client';
import { getOrganizationsPageData } from '@/modules/auth/actions';

export default async function MemberOrganizationsPage() {
  const data = await getOrganizationsPageData();
  if (!data) redirect('/login');

  return <OrganizationsPageClient session={data.session} memberships={data.memberships} />;
}
