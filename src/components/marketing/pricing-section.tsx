'use client';

import type { PlanTier } from '@/generated/prisma/client';
import { PLAN_CATALOG, type PlanDefinition } from '@/modules/organizations/plans';

function PlanCard({
  plan,
  selectable,
  selected,
  highlighted,
  name,
}: {
  plan: PlanDefinition;
  selectable?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  name?: string;
}) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-zinc-900">{plan.name}</h3>
        <p className="text-sm font-medium text-zinc-700">{plan.priceLabel}</p>
      </div>
      <p className="mt-1 text-sm text-zinc-600">{plan.description}</p>
      <ul className="mt-3 space-y-1.5 text-sm text-zinc-700">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <span className="text-zinc-400" aria-hidden>
              •
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {highlighted ? (
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Plano atual</p>
      ) : null}
    </>
  );

  if (selectable && name) {
    return (
      <label className="block cursor-pointer rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-400 has-[:checked]:border-zinc-900 has-[:checked]:ring-2 has-[:checked]:ring-zinc-900">
        <input
          type="radio"
          name={name}
          value={plan.tier}
          required
          defaultChecked={selected}
          className="sr-only"
        />
        {body}
      </label>
    );
  }

  const ring = highlighted ? 'border-zinc-900 ring-2 ring-zinc-900' : 'border-zinc-200';
  return <div className={`rounded-2xl border bg-white p-4 ${ring}`}>{body}</div>;
}

export function PricingSection({
  mode = 'display',
  selectedTier,
  highlightTier,
  inputName = 'planTier',
  title = 'Planos',
  subtitle,
}: {
  mode?: 'display' | 'select';
  selectedTier?: PlanTier;
  highlightTier?: PlanTier;
  inputName?: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-zinc-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-zinc-600">{subtitle}</p> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {PLAN_CATALOG.map((plan) => (
          <PlanCard
            key={plan.tier}
            plan={plan}
            selectable={mode === 'select'}
            selected={selectedTier === plan.tier}
            highlighted={highlightTier === plan.tier}
            name={inputName}
          />
        ))}
      </div>
    </section>
  );
}
