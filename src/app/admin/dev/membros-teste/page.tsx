import { redirect } from 'next/navigation';
import { CreateTestMemberForm } from '@/components/dev/create-test-member-form';
import { isDeveloperEmail } from '@/lib/developer';
import { getSessionFromCookies } from '@/modules/auth/session';
import { prisma } from '@/lib/prisma';

export default async function DevCreateTestMembersPage() {
  const session = await getSessionFromCookies();
  if (!session || session.loginMode !== 'admin') {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });

  if (!isDeveloperEmail(user?.email)) {
    redirect('/admin/escala');
  }

  return <CreateTestMemberForm organizationName={session.organizationName} />;
}
