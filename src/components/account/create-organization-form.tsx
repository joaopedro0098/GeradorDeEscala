'use client';

import { createOrganizationAction, type ActionState } from '@/modules/auth/actions';
import { Alert, Field } from '@/components/auth/auth-ui';
import { GlassCard } from '@/components/ui/glass-card';
import { useToastActionState } from '@/components/ui/success-toast';

export function CreateOrganizationForm({ isFirstOrganization }: { isFirstOrganization: boolean }) {
  const [state, formAction] = useToastActionState<ActionState>(createOrganizationAction, {});

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
        <div>
          <button
            type="submit"
            className="btn-accent inline-flex rounded-xl px-4 py-2.5 text-sm font-semibold shadow-md transition"
          >
            Criar organização
          </button>
        </div>
      </form>
    </GlassCard>
  );
}
