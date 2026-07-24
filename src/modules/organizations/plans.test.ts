import { describe, expect, it } from 'vitest';
import { getPlanDefinition, isPlanTier, PLAN_CATALOG } from '@/modules/organizations/plans';

describe('plans catalog', () => {
  it('exposes exactly three placeholder monthly plans', () => {
    expect(PLAN_CATALOG).toHaveLength(3);
    expect(PLAN_CATALOG.map((plan) => plan.tier)).toEqual(['BASIC', 'PRO', 'ENTERPRISE']);
    for (const plan of PLAN_CATALOG) {
      expect(plan.priceLabel).toMatch(/R\$ .+\/mês/);
      expect(plan.features.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('resolves and validates plan tiers', () => {
    expect(getPlanDefinition('PRO').name).toBe('Profissional');
    expect(isPlanTier('BASIC')).toBe(true);
    expect(isPlanTier('FREE')).toBe(false);
  });
});
