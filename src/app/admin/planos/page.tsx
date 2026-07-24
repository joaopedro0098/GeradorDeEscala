import { redirect } from 'next/navigation';
import { PricingSection } from '@/components/marketing/pricing-section';
import { requireSession } from '@/lib/auth.server';
import { canViewPlans } from '@/modules/auth/permissions';
import { prisma } from '@/lib/prisma';
import { getPlanDefinition } from '@/modules/organizations/plans';

export default async function AdminPlansPage() {
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
    <section className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Planos</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Organização <span className="font-medium text-zinc-900">{organization.name}</span> está no
          plano <span className="font-medium text-zinc-900">{currentPlan.name}</span> (
          {currentPlan.priceLabel}). Upgrade/pagamento real ainda não está disponível nesta versão.
        </p>
      </div>

      <PricingSection
        highlightTier={organization.planTier}
        title="Comparativo"
        subtitle="Valores mensais ilustrativos."
      />
    </section>
  );
}
