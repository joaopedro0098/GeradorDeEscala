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
      title="Criar conta"
      subtitle="Informe nome, e-mail e senha. Em seguida você escolhe ou cria uma organização."
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

        <div className="pt-1">
          <PrimaryButton label="Criar conta gratuita" />
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{' '}
        <Link
          href="/login"
          className="font-semibold text-foreground underline decoration-gold/50 underline-offset-4 transition hover:text-primary"
        >
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
