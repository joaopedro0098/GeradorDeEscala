import { redirect } from 'next/navigation';
import { CreateOrganizationPlansForm } from '@/components/organizations/create-organization-plans-form';
import { PricingSection } from '@/components/marketing/pricing-section';
import { getAppShellContext } from '@/lib/app-shell.server';
import { requireSession } from '@/lib/auth.server';
import { canViewPlans } from '@/modules/auth/permissions';
import { prisma } from '@/lib/prisma';
import { getPlanDefinition } from '@/modules/organizations/plans';

export default async function AdminPlansPage() {
  const context = await getAppShellContext({ loginMode: 'admin' });
  if (!context) redirect('/login');

  if (!context.session) {
    return (
      <div className="space-y-6">
        <CreateOrganizationPlansForm isFirstOrganization />
      </div>
    );
  }

  const session = await requireSession({ loginMode: 'admin' });

  if (!canViewPlans(session)) {
    redirect('/admin');
  }

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
    select: { planTier: true, name: true },
  });

  const currentPlan = getPlanDefinition(organization.planTier);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Plano atual</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Organização <span className="font-medium text-zinc-900">{organization.name}</span> está no plano{' '}
          <span className="font-medium text-zinc-900">{currentPlan.name}</span> ({currentPlan.priceLabel}).
          Upgrade/pagamento real ainda não está disponível nesta versão.
        </p>
      </section>

      <PricingSection
        highlightTier={organization.planTier}
        title="Comparativo"
        subtitle="Valores mensais ilustrativos."
      />

      <CreateOrganizationPlansForm isFirstOrganization={false} />
    </div>
  );
}
