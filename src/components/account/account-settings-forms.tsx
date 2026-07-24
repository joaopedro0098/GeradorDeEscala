'use client';

import { useActionState } from 'react';
import { updateEmailAction, updatePasswordAction, type ActionState } from '@/modules/auth/actions';
import { Alert, Field, PrimaryButton } from '@/components/auth/auth-ui';

export function AccountSettingsForms({ email }: { email: string }) {
  const [emailState, emailAction] = useActionState<ActionState, FormData>(updateEmailAction, {});
  const [passwordState, passwordAction] = useActionState<ActionState, FormData>(
    updatePasswordAction,
    {},
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Alterar e-mail</h2>
        <form action={emailAction} className="mt-4 space-y-3">
          <Field label="Novo e-mail" name="email" type="email" defaultValue={email} />
          {emailState.error ? <Alert message={emailState.error} tone="error" /> : null}
          {emailState.success ? <Alert message={emailState.success} tone="success" /> : null}
          <PrimaryButton label="Salvar e-mail" />
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Alterar senha</h2>
        <form action={passwordAction} className="mt-4 space-y-3">
          <Field label="Senha atual" name="currentPassword" type="password" />
          <Field label="Nova senha" name="newPassword" type="password" />
          <Field label="Confirmar nova senha" name="confirmPassword" type="password" />
          {passwordState.error ? <Alert message={passwordState.error} tone="error" /> : null}
          {passwordState.success ? <Alert message={passwordState.success} tone="success" /> : null}
          <PrimaryButton label="Salvar senha" />
        </form>
      </section>
    </div>
  );
}
