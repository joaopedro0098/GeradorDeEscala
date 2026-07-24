'use client';

import { useActionState } from 'react';
import { joinOrganizationAction, switchContextAction, type ActionState } from '@/modules/auth/actions';
import { Alert, Field, PrimaryButton } from '@/components/auth/auth-ui';
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
      <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 text-sm text-zinc-600">
        Nenhuma participação ainda. Para criar a sua, use a aba <span className="font-medium text-zinc-900">Planos</span>.
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
            className={`rounded-xl border bg-white px-4 py-3 ${
              isCurrent ? 'border-zinc-900' : 'border-zinc-200'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-zinc-900">{membership.organizationName}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
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
                        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white"
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
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800"
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
    <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="text-sm font-medium text-zinc-900">Entrar com código</h3>
      <p className="mt-1 text-xs text-zinc-600">
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
    </section>
  );
}

export function OrganizationsPageClient({
  session,
  memberships,
}: {
  session: SessionPayload | null;
  memberships: MembershipSummary[];
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Suas organizações</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Troque de contexto no estilo perfil. Criar uma nova organização fica na aba Planos.
        </p>
        <div className="mt-4">
          <OrganizationList memberships={memberships} currentMembershipId={session?.membershipId} />
        </div>
      </section>

      <JoinOrganizationPanel />
    </div>
  );
}
