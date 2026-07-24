import type { PlanTier } from '@/generated/prisma/client';

export type PlanDefinition = {
  tier: PlanTier;
  name: string;
  priceLabel: string;
  description: string;
  features: string[];
};

/** Placeholder catalog — prices are fictional monthly subscriptions for UI only. */
export const PLAN_CATALOG: PlanDefinition[] = [
  {
    tier: 'BASIC',
    name: 'Básico',
    priceLabel: 'R$ 49,90/mês',
    description: 'Para equipes pequenas que estão começando.',
    features: [
      'Até 20 membros ativos',
      'Geração de escala mensal',
      'Disponibilidade e lacunas',
    ],
  },
  {
    tier: 'PRO',
    name: 'Profissional',
    priceLabel: 'R$ 99,90/mês',
    description: 'Para ministérios e equipes em crescimento.',
    features: [
      'Até 80 membros ativos',
      'Grupos, prioridade e regras avançadas',
      'Edição manual e versionamento',
    ],
  },
  {
    tier: 'ENTERPRISE',
    name: 'Empresarial',
    priceLabel: 'R$ 199,90/mês',
    description: 'Para organizações com múltiplas equipes.',
    features: [
      'Membros ilimitados',
      'Múltiplas organizações por conta',
      'Suporte prioritário (placeholder)',
    ],
  },
];

export function getPlanDefinition(tier: PlanTier): PlanDefinition {
  const plan = PLAN_CATALOG.find((item) => item.tier === tier);
  if (!plan) {
    throw new Error(`Plano desconhecido: ${tier}`);
  }
  return plan;
}

export function isPlanTier(value: string): value is PlanTier {
  return PLAN_CATALOG.some((plan) => plan.tier === value);
}
