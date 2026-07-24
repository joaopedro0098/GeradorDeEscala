'use client';

import { useActionState } from 'react';
import { createTestMemberAction, type ActionState } from '@/modules/auth/actions';
import { Alert, Field, PrimaryButton } from '@/components/auth/auth-ui';
import { GlassCard } from '@/components/ui/glass-card';

export function CreateTestMemberForm({ organizationName }: { organizationName: string }) {
  const [state, action] = useActionState<ActionState, FormData>(createTestMemberAction, {});

  return (
    <GlassCard className="glass-card p-6">
      <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Admin</h2>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Área só do desenvolvedor. Criar membros de teste na organização atual:{' '}
        <span className="font-medium text-[var(--text-primary)]">{organizationName}</span>.
        O membro nasce ativo e é tratado como membro normal.
      </p>

      <form action={action} className="mt-5 space-y-3">
        <Field label="Nome" name="name" />
        <Field label="E-mail" name="email" type="email" />
        <Field label="Senha" name="password" type="password" defaultValue="teste1234" />
        {state.error ? <Alert message={state.error} tone="error" /> : null}
        {state.success ? <Alert message={state.success} tone="success" /> : null}
        <div className="max-w-[14rem]">
          <PrimaryButton label="Criar membro" />
        </div>
      </form>
    </GlassCard>
  );
}
