'use client';

import { useActionState } from 'react';
import { CreateOrganizationForm } from '@/components/account/create-organization-form';
import { joinOrganizationAction, switchContextAction, type ActionState } from '@/modules/auth/actions';
import { Alert, Field, PrimaryButton } from '@/components/auth/auth-ui';
import { GlassCard } from '@/components/ui/glass-card';
import type { MembershipSummary, SessionPayload } from '@/modules/auth/types';

function roleLabel(membership: MembershipSummary): string {
  if (membership.isPrimaryAdmin) return 'Admin principal';
  if (membership.isAdmin) return 'Admin';
  return 'Membro';
}

function OrganizationList({
  memberships,
  currentMembershipId,
}: {
  memberships: MembershipSummary[];
  currentMembershipId?: string;
}) {
  if (memberships.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--glass-border)] bg-white/30 px-4 py-5 text-sm text-[var(--text-secondary)]">
        Nenhuma participação ainda. Crie uma organização abaixo ou entre com um código de convite.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {memberships.map((membership) => {
        const isCurrent = membership.id === currentMembershipId;
        const isPending = membership.status === 'PENDING';
        const isRejected = membership.status === 'REJECTED';
        const canSwitch = membership.status === 'ACTIVE' && !isCurrent;

        return (
          <li
            key={membership.id}
            className={`rounded-xl border px-4 py-3 backdrop-blur-sm ${
              isCurrent
                ? 'border-[var(--btn-primary-bg)]/30 bg-white/70'
                : 'border-[var(--glass-border)] bg-white/40'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-[var(--text-primary)]">{membership.organizationName}</p>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  {roleLabel(membership)}
                  {membership.isAdmin ? ' · também pode entrar como membro' : ''}
                  {isPending ? ' · Aguardando aprovação' : ''}
                  {isRejected ? ' · Recusado' : ''}
                  {isCurrent ? ' · Atual' : ''}
                </p>
              </div>

              {canSwitch ? (
                <div className="flex flex-wrap gap-2">
                  {membership.isAdmin ? (
                    <form action={switchContextAction}>
                      <input type="hidden" name="membershipId" value={membership.id} />
                      <input type="hidden" name="loginMode" value="admin" />
                      <button
                        type="submit"
                        className="btn-solid rounded-lg px-3 py-1.5 text-xs font-medium"
                      >
                        Entrar como Admin
                      </button>
                    </form>
                  ) : null}
                  <form action={switchContextAction}>
                    <input type="hidden" name="membershipId" value={membership.id} />
                    <input type="hidden" name="loginMode" value="user" />
                    <button
                      type="submit"
                      className="rounded-lg border border-[var(--glass-border)] bg-white/50 px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] backdrop-blur-sm hover:bg-white/80"
                    >
                      {membership.isAdmin ? 'Entrar como Membro' : 'Trocar para esta'}
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function JoinOrganizationPanel() {
  const [state, formAction] = useActionState<ActionState, FormData>(joinOrganizationAction, {});

  return (
    <GlassCard className="glass-card p-5">
      <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">Entrar com código</h3>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">
        Use o código de convite. A entrada fica pendente até um administrador aprovar.
      </p>
      <form action={formAction} className="mt-4 space-y-3">
        <Field label="Código da organização" name="inviteCode" />
        <PrimaryButton label="Solicitar entrada" />
      </form>
      {state.error ? (
        <div className="mt-3">
          <Alert message={state.error} tone="error" />
        </div>
      ) : null}
      {state.success ? (
        <div className="mt-3">
          <Alert message={state.success} tone="success" />
        </div>
      ) : null}
    </GlassCard>
  );
}

export function OrganizationsPageClient({
  session,
  memberships,
}: {
  session: SessionPayload | null;
  memberships: MembershipSummary[];
}) {
  const isFirstOrganization =
    !session && !memberships.some((membership) => membership.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      <GlassCard className="glass-card p-6">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
          Suas organizações
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Troque de contexto no estilo perfil. Criar uma nova organização não troca automaticamente.
        </p>
        <div className="mt-4">
          <OrganizationList memberships={memberships} currentMembershipId={session?.membershipId} />
        </div>
      </GlassCard>

      <CreateOrganizationForm isFirstOrganization={isFirstOrganization} />
      <JoinOrganizationPanel />
    </div>
  );
}
