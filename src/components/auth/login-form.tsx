'use client';

import { useActionState } from 'react';
import { loginAction, type ActionState } from '@/modules/auth/actions';
import { Alert, AuthShell, Field, PrimaryButton } from '@/components/auth/auth-ui';
import Link from 'next/link';

export function LoginForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(loginAction, {});

  return (
    <AuthShell title="Entrar" subtitle="Escolha se deseja acessar como usuário ou administrador.">
      <form action={formAction} className="space-y-4">
        <Field label="E-mail" name="email" type="email" />
        <Field label="Senha" name="password" type="password" />

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-800">Entrar como</legend>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="radio" name="loginMode" value="user" defaultChecked />
            Usuário
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="radio" name="loginMode" value="admin" />
            Admin
          </label>
        </fieldset>

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
