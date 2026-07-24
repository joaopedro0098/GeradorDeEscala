'use client';

import { useActionState, useState } from 'react';
import { registerAction, type ActionState } from '@/modules/auth/actions';
import { Alert, AuthShell, Field, PrimaryButton } from '@/components/auth/auth-ui';
import { PasswordField } from '@/components/auth/password-field';
import Link from 'next/link';

const MIN_PASSWORD_LENGTH = 8;

export function RegisterForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(registerAction, {});
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      event.preventDefault();
      setClientError(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (password !== confirmPassword) {
      event.preventDefault();
      setClientError('As senhas não coincidem.');
      return;
    }

    setClientError(null);
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    if (clientError) setClientError(null);
  }

  function handleConfirmPasswordChange(value: string) {
    setConfirmPassword(value);
    if (clientError) setClientError(null);
  }

  const errorMessage = clientError ?? state.error;

  return (
    <AuthShell
      title="Cadastro"
      subtitle="Crie sua conta com nome, e-mail e senha. Você entra direto para escolher ou criar uma organização."
    >
      <form action={formAction} className="space-y-4" onSubmit={handleSubmit}>
        <Field label="Nome" name="name" />
        <Field label="E-mail" name="email" type="email" />
        <PasswordField
          label="Senha"
          name="password"
          value={password}
          autoComplete="new-password"
          onChange={handlePasswordChange}
        />
        <PasswordField
          label="Confirmar senha"
          value={confirmPassword}
          autoComplete="new-password"
          onChange={handleConfirmPasswordChange}
        />

        {errorMessage ? <Alert message={errorMessage} tone="error" /> : null}

        <PrimaryButton label="Criar conta" />
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
