'use client';

import { useActionState } from 'react';
import { createOrganizationAction, type ActionState } from '@/modules/auth/actions';
import { Alert, Field, PrimaryButton } from '@/components/auth/auth-ui';

export function CreateOrganizationForm({ isFirstOrganization }: { isFirstOrganization: boolean }) {
  const [state, formAction] = useActionState<ActionState, FormData>(createOrganizationAction, {});

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="text-sm font-medium text-zinc-900">Criar organização</h3>
      <p className="mt-1 text-xs text-zinc-600">
        {isFirstOrganization
          ? 'Ao criar, você vira admin principal e começa um período de teste de 14 dias.'
          : 'A nova organização entra na lista acima. Você continua na organização atual até trocar manualmente.'}
      </p>
      <form action={formAction} className="mt-4 space-y-3">
        <Field label="Nome da organização" name="organizationName" />
        {state.error ? <Alert message={state.error} tone="error" /> : null}
        {state.success ? <Alert message={state.success} tone="success" /> : null}
        <PrimaryButton label="Criar organização" />
      </form>
    </section>
  );
}
