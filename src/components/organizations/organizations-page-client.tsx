'use client';

import { useActionState } from 'react';
import {
  createOrganizationAction,
  joinOrganizationAction,
  switchContextAction,
  type ActionState,
} from '@/modules/auth/actions';
import { Alert, Field, PrimaryButton } from '@/components/auth/auth-ui';
import { PricingSection } from '@/components/marketing/pricing-section';
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
      <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-sm text-zinc-600">
        Você ainda não participa de nenhuma organização. Crie uma nova ou entre com um código de
        convite.
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

function CreateOrganizationPanel({ isFirstOrganization }: { isFirstOrganization: boolean }) {
  const [state, formAction] = useActionState<ActionState, FormData>(createOrganizationAction, {});

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-zinc-900">Criar organização</h2>
      <p className="mt-1 text-sm text-zinc-600">
        {isFirstOrganization
          ? 'Escolha um plano e confirme para criar sua primeira organização.'
          : 'A nova organização aparece na lista acima. Você continua na organização atual até trocar manualmente.'}
      </p>
      <form action={formAction} className="mt-4 space-y-4">
        <Field label="Nome da organização" name="organizationName" />
        <PricingSection
          mode="select"
          selectedTier="BASIC"
          title="Escolha um plano"
          subtitle="Assinatura mensal (valores ilustrativos — sem cobrança nesta versão)."
        />
        {state.error ? <Alert message={state.error} tone="error" /> : null}
        {state.success ? <Alert message={state.success} tone="success" /> : null}
        <PrimaryButton label="Criar organização" />
      </form>
    </section>
  );
}

function JoinOrganizationPanel() {
  const [state, formAction] = useActionState<ActionState, FormData>(joinOrganizationAction, {});

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-zinc-900">Entrar com código</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Informe o código de convite. O vínculo fica pendente até um administrador aprovar.
      </p>
      <form action={formAction} className="mt-4 space-y-4">
        <Field label="Código da organização" name="inviteCode" />
        {state.error ? <Alert message={state.error} tone="error" /> : null}
        {state.success ? <Alert message={state.success} tone="success" /> : null}
        <PrimaryButton label="Solicitar entrada" />
      </form>
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
  const hasActive = memberships.some((membership) => membership.status === 'ACTIVE');
  const isFirstOrganization = !session && !hasActive;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <header>
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          {session ? 'Trocar organização' : 'Configurar organizações'}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Suas organizações</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {session
            ? 'Toque em uma organização para trocar de contexto, no estilo de troca de perfil. Criar uma nova não troca automaticamente.'
            : 'Crie uma organização ou entre com um código de convite para continuar.'}
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Participações
        </h2>
        <OrganizationList memberships={memberships} currentMembershipId={session?.membershipId} />
      </section>

      <CreateOrganizationPanel isFirstOrganization={isFirstOrganization} />
      <JoinOrganizationPanel />
    </div>
  );
}
