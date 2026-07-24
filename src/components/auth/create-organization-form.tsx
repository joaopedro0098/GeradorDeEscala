'use client';

import { useActionState } from 'react';
import { createOrganizationAction, type ActionState } from '@/modules/auth/actions';
import { Alert, AuthShell, Field, PrimaryButton } from '@/components/auth/auth-ui';

export function CreateOrganizationForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(createOrganizationAction, {});

  return (
    <AuthShell
      title="Criar organização"
      subtitle="Nenhuma organização de administrador encontrada para este e-mail. Deseja criar uma nova organização?"
    >
      <form action={formAction} className="space-y-4">
        <Field label="Nome da organização" name="organizationName" />
        {state.error ? <Alert message={state.error} tone="error" /> : null}
        <PrimaryButton label="Confirmar e criar organização" />
      </form>
    </AuthShell>
  );
}
