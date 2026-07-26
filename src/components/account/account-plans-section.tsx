import type { PlanTier, SubscriptionStatus } from '@/generated/prisma/client';
import { PricingSection } from '@/components/marketing/pricing-section';
import { TrialProgressBar } from '@/components/account/trial-progress-bar';
import { GlassCard } from '@/components/ui/glass-card';
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
  const showSubscribeMessage = !isActive;

  return (
    <div className="space-y-6">
      {organization.subscriptionStatus === 'TRIAL' && !trialProgress.isExpired ? (
        <TrialProgressBar progress={trialProgress} />
      ) : null}

      {showSubscribeMessage ? (
        <GlassCard className="glass-card p-6">
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
            Assine um plano para continuar usando
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            O período de teste terminou. Escolha um plano abaixo para voltar a gerar escalas.
            (Pagamento via Stripe será habilitado em breve.)
          </p>
        </GlassCard>
      ) : null}

      <GlassCard className="glass-card p-6">
        <PricingSection
          highlightTier={organization.planTier}
          title="Planos"
          subtitle="Valores mensais ilustrativos. A cobrança real será integrada com Stripe."
        />
      </GlassCard>
    </div>
  );
}
