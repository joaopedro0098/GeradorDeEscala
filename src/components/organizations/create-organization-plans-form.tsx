'use client';

import { useActionState } from 'react';
import { createOrganizationAction, type ActionState } from '@/modules/auth/actions';
import { Alert, Field, PrimaryButton } from '@/components/auth/auth-ui';
import { PricingSection } from '@/components/marketing/pricing-section';

export function CreateOrganizationPlansForm({ isFirstOrganization }: { isFirstOrganization: boolean }) {
  const [state, formAction] = useActionState<ActionState, FormData>(createOrganizationAction, {});

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6">
      {!isFirstOrganization ? (
        <p className="mb-4 text-sm text-zinc-600">
          A nova organização entra na lista em Organizações. Você continua na organização atual até trocar
          manualmente.
        </p>
      ) : null}

      <form action={formAction} className="space-y-4">
        <Field label="Nome da organização" name="organizationName" />
        <PricingSection
          mode="select"
          selectedTier="BASIC"
          title="Escolha um plano"
          subtitle="Assinatura mensal (valores ilustrativos — sem cobrança nesta versão)."
        />
        {state.error ? <Alert message={state.error} tone="error" /> : null}
        {state.success ? <Alert message={state.success} tone="success" /> : null}
        <PrimaryButton label="Criar organização" />
      </form>
    </section>
  );
}
