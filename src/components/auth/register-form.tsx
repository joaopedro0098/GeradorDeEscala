'use client';

import { useActionState } from 'react';
import { registerAction, type ActionState } from '@/modules/auth/actions';
import { Alert, AuthShell, Field, PrimaryButton } from '@/components/auth/auth-ui';
import Link from 'next/link';

export function RegisterForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(registerAction, {});

  return (
    <AuthShell
      title="Cadastro"
      subtitle="Informe o código da organização fornecido pelo administrador."
    >
      <form action={formAction} className="space-y-4">
        <Field label="Nome" name="name" />
        <Field label="E-mail" name="email" type="email" />
        <Field label="Senha" name="password" type="password" />
        <Field label="Código da organização" name="inviteCode" />

        {state.error ? <Alert message={state.error} tone="error" /> : null}
        {state.success ? <Alert message={state.success} tone="success" /> : null}

        <PrimaryButton label="Enviar cadastro" />
      </form>

      <p className="mt-4 text-center text-sm text-zinc-600">
        Já tem conta?{' '}
        <Link href="/login" className="font-medium text-zinc-900 underline">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
