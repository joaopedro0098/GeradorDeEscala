import { redirect } from 'next/navigation';
import { CreateTestMemberForm } from '@/components/dev/create-test-member-form';
import { AvailabilitySimulator } from '@/components/dev/availability-simulator';
import { isDeveloperEmail } from '@/lib/developer';
import { getSessionFromCookies } from '@/modules/auth/session';
import { prisma } from '@/lib/prisma';
import { getDevSimulationPageData } from '@/modules/dev/actions';

export default async function DevToolsPage() {
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

  const simulation = await getDevSimulationPageData();
  if (!simulation) {
    redirect('/admin/escala');
  }

  return (
    <div className="space-y-8">
      <CreateTestMemberForm organizationName={session.organizationName} />
      <AvailabilitySimulator
        workingMonth={simulation.workingMonth}
        cultEventCount={simulation.cultEventCount}
        members={simulation.members}
        matrix={simulation.matrix}
      />
    </div>
  );
}
