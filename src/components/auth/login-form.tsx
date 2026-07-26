'use client';

import { useActionState } from 'react';
import { loginAction, type ActionState } from '@/modules/auth/actions';
import { Alert, AuthShell, Field, PrimaryButton } from '@/components/auth/auth-ui';
import Link from 'next/link';

export function LoginForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(loginAction, {});

  return (
    <AuthShell
      title="Entrar"
      subtitle="Acesse com seu e-mail e senha. A organização e o papel são escolhidos depois, dentro do app."
    >
      <form action={formAction} className="space-y-4">
        <Field label="E-mail" name="email" type="email" autoComplete="username" />
        <Field label="Senha" name="password" type="password" autoComplete="current-password" />

        {state.error ? <Alert message={state.error} tone="error" /> : null}

        <div className="pt-1">
          <PrimaryButton label="Entrar" />
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Não tem conta?{' '}
        <Link href="/cadastro" className="font-semibold text-foreground underline decoration-gold/50 underline-offset-4 transition hover:text-primary">
          Cadastre-se
        </Link>
      </p>
    </AuthShell>
  );
}
