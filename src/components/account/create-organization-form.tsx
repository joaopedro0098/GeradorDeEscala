'use client';

import { useActionState } from 'react';
import { createOrganizationAction, type ActionState } from '@/modules/auth/actions';
import { Alert, Field } from '@/components/auth/auth-ui';
import { GlassCard } from '@/components/ui/glass-card';

export function CreateOrganizationForm({ isFirstOrganization }: { isFirstOrganization: boolean }) {
  const [state, formAction] = useActionState<ActionState, FormData>(createOrganizationAction, {});

  return (
    <GlassCard className="glass-card p-5">
      <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">Criar organização</h3>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">
        {isFirstOrganization
          ? 'Ao criar, você vira admin principal e começa um período de teste de 14 dias.'
          : 'A nova organização entra na lista acima. Você continua na organização atual até trocar manualmente.'}
      </p>
      <form action={formAction} className="mt-4 space-y-3">
        <Field label="Nome da organização" name="organizationName" />
        {state.error ? <Alert message={state.error} tone="error" /> : null}
        {state.success ? <Alert message={state.success} tone="success" /> : null}
        <button
          type="submit"
          className="btn-accent w-full rounded-xl px-4 py-3 text-sm font-semibold shadow-md transition"
        >
          Criar organização
        </button>
      </form>
    </GlassCard>
  );
}
