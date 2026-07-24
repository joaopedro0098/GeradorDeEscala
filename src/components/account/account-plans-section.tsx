import type { PlanTier, SubscriptionStatus } from '@/generated/prisma/client';
import { PricingSection } from '@/components/marketing/pricing-section';
import { TrialProgressBar } from '@/components/account/trial-progress-bar';
import { getPlanDefinition } from '@/modules/organizations/plans';
import {
  getTrialProgress,
  isOrganizationSubscriptionActive,
} from '@/modules/organizations/subscription.logic';

export function AccountPlansSection({
  organization,
}: {
  organization: {
    name: string;
    planTier: PlanTier;
    subscriptionStatus: SubscriptionStatus;
    trialStartedAt: Date;
  };
}) {
  const trialProgress = getTrialProgress(organization.trialStartedAt);
  const isActive = isOrganizationSubscriptionActive(organization);
  const currentPlan = getPlanDefinition(organization.planTier);
  const showSubscribeMessage = !isActive;

  return (
    <div className="space-y-6">
      {organization.subscriptionStatus === 'TRIAL' && !trialProgress.isExpired ? (
        <TrialProgressBar progress={trialProgress} />
      ) : null}

      {showSubscribeMessage ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-950">Assine um plano para continuar usando</h2>
          <p className="mt-2 text-sm text-amber-900">
            O período de teste terminou. Escolha um plano abaixo para voltar a gerar escalas.
            (Pagamento via Stripe será habilitado em breve.)
          </p>
        </section>
      ) : (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Plano atual</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Organização <span className="font-medium text-zinc-900">{organization.name}</span> está no plano{' '}
            <span className="font-medium text-zinc-900">{currentPlan.name}</span> ({currentPlan.priceLabel}).
          </p>
        </section>
      )}

      <PricingSection
        highlightTier={organization.planTier}
        title="Planos"
        subtitle="Valores mensais ilustrativos. A cobrança real será integrada com Stripe."
      />
    </div>
  );
}
