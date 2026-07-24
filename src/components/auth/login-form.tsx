'use client';

import { useActionState } from 'react';
import { loginAction, type ActionState } from '@/modules/auth/actions';
import { Alert, AuthShell, Field, PrimaryButton } from '@/components/auth/auth-ui';
import Link from 'next/link';

export function LoginForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(loginAction, {});

  return (
    <AuthShell title="Entrar" subtitle="Acesse com seu e-mail e senha. A organização e o papel são escolhidos depois, dentro do app.">
      <form action={formAction} className="space-y-4">
        <Field label="E-mail" name="email" type="email" />
        <Field label="Senha" name="password" type="password" />

        {state.error ? <Alert message={state.error} tone="error" /> : null}

        <PrimaryButton label="Entrar" />
      </form>

      <p className="mt-4 text-center text-sm text-zinc-600">
        Não tem conta?{' '}
        <Link href="/cadastro" className="font-medium text-zinc-900 underline">
          Cadastre-se
        </Link>
      </p>
    </AuthShell>
  );
}
