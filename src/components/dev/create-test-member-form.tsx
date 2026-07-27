'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { createTestMemberAction, type ActionState } from '@/modules/auth/actions';
import { Alert, Field, PrimaryButton } from '@/components/auth/auth-ui';
import { GlassCard } from '@/components/ui/glass-card';
import { useToastActionState } from '@/components/ui/success-toast';

export function CreateTestMemberForm({ organizationName }: { organizationName: string }) {
  const [state, action] = useToastActionState<ActionState>(createTestMemberAction, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <GlassCard className="glass-card p-6">
      <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Admin</h2>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Área só do desenvolvedor. Criar membros de teste na organização atual:{' '}
        <span className="font-medium text-[var(--text-primary)]">{organizationName}</span>.
        O membro nasce ativo, entra pelo login com este e-mail e senha, e é tratado como membro normal.
        Se o e-mail já existir, a senha informada aqui passa a valer no login.
      </p>

      <form action={action} className="mt-5 space-y-3">
        <Field label="Nome" name="name" />
        <Field label="E-mail" name="email" type="email" />

        <label className="block text-sm font-medium text-foreground">
          Senha
          <div className="relative mt-1.5">
            <input
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 pr-11 text-base text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20 sm:text-sm"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              defaultValue="teste1234"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        {state.error ? <Alert message={state.error} tone="error" /> : null}
        <div>
          <PrimaryButton label="Criar membro" fullWidth={false} />
        </div>
      </form>
    </GlassCard>
  );
}
