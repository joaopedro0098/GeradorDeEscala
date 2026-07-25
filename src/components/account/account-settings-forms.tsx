'use client';

import { updateEmailAction, updatePasswordAction, type ActionState } from '@/modules/auth/actions';
import { Alert, Field, PrimaryButton } from '@/components/auth/auth-ui';
import { GlassCard } from '@/components/ui/glass-card';
import { useToastActionState } from '@/components/ui/success-toast';

export function AccountSettingsForms({ email }: { email: string }) {
  const [emailState, emailAction] = useToastActionState<ActionState>(updateEmailAction, {});
  const [passwordState, passwordAction] = useToastActionState<ActionState>(
    updatePasswordAction,
    {},
  );

  return (
    <div className="space-y-6">
      <GlassCard className="glass-card p-6">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Alterar e-mail</h2>
        <form action={emailAction} className="mt-4 space-y-3">
          <Field label="Novo e-mail" name="email" type="email" defaultValue={email} />
          {emailState.error ? <Alert message={emailState.error} tone="error" /> : null}
          <div className="pt-1">
            <PrimaryButton label="Salvar e-mail" fullWidth={false} />
          </div>
        </form>
      </GlassCard>

      <GlassCard className="glass-card p-6">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Alterar senha</h2>
        <form action={passwordAction} className="mt-4 space-y-3">
          <Field label="Senha atual" name="currentPassword" type="password" />
          <Field label="Nova senha" name="newPassword" type="password" />
          <Field label="Confirmar nova senha" name="confirmPassword" type="password" />
          {passwordState.error ? <Alert message={passwordState.error} tone="error" /> : null}
          <div className="pt-1">
            <PrimaryButton label="Salvar senha" fullWidth={false} />
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
