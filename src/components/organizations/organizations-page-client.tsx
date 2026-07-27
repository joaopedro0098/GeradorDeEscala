'use client';

import { CreateOrganizationForm } from '@/components/account/create-organization-form';
import { OrganizationProfileForm } from '@/components/account/organization-profile-form';
import { SelfLeaveOrganizationButton } from '@/components/organizations/self-leave-organization-button';
import { joinOrganizationAction, switchContextAction, type ActionState } from '@/modules/auth/actions';
import { canCreateTeam, getAssociatedTeamMembership } from '@/modules/auth/permissions';
import { Alert, Field } from '@/components/auth/auth-ui';
import { GlassCard } from '@/components/ui/glass-card';
import { useToastActionState } from '@/components/ui/success-toast';
import type { MembershipSummary, SessionPayload } from '@/modules/auth/types';

function roleLabel(membership: MembershipSummary): string {
  if (membership.isPrimaryAdmin) return 'Admin principal';
  if (membership.isAdmin) return 'Admin';
  return 'Membro';
}

function OrganizationList({
  memberships,
  currentMembershipId,
  emptyHint,
}: {
  memberships: MembershipSummary[];
  currentMembershipId?: string;
  emptyHint: string;
}) {
  if (memberships.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--glass-border)] bg-white/30 px-4 py-5 text-sm text-[var(--text-secondary)]">
        {emptyHint}
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
  const [state, formAction] = useToastActionState<ActionState>(joinOrganizationAction, {});

  return (
    <div>
      <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">Entrar com código</h3>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">
        Use o código de convite. A entrada fica pendente até um administrador aprovar.
      </p>
      <form action={formAction} className="mt-4 space-y-3">
        <Field label="Código da organização" name="inviteCode" />
        <div>
          <button
            type="submit"
            className="btn-solid rounded-lg px-4 py-2.5 text-sm font-medium"
          >
            Solicitar entrada
          </button>
        </div>
      </form>
      {state.error ? (
        <div className="mt-3">
          <Alert message={state.error} tone="error" />
        </div>
      ) : null}
    </div>
  );
}

function getJoinedTeamMembership(
  memberships: MembershipSummary[],
  session: SessionPayload | null,
): MembershipSummary | null {
  return getAssociatedTeamMembership(memberships, session);
}

export function OrganizationsPageClient({
  session,
  memberships,
  canEditProfile = false,
  organizationProfile = null,
  area = 'admin',
}: {
  session: SessionPayload | null;
  memberships: MembershipSummary[];
  canEditProfile?: boolean;
  organizationProfile?: { name: string; logoUrl: string | null } | null;
  area?: 'admin' | 'member';
}) {
  const isFirstOrganization =
    !session && !memberships.some((membership) => membership.status === 'ACTIVE');
  const isAdminArea = area === 'admin';
  const showCreateTeam = canCreateTeam(memberships);
  const joinedTeamMembership = getJoinedTeamMembership(memberships, session);
  const showJoinedTeamView = !isAdminArea && joinedTeamMembership !== null;
  const canJoinTeam = joinedTeamMembership === null;

  if (showJoinedTeamView) {
    return (
      <GlassCard className="glass-card p-6">
        <p className="text-sm text-[var(--text-primary)]">
          Você está associado a:{' '}
          <span className="font-semibold">{joinedTeamMembership.organizationName}</span>
        </p>
        <div className="mt-4">
          <SelfLeaveOrganizationButton membershipId={joinedTeamMembership.id} />
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      {canEditProfile && organizationProfile ? (
        <OrganizationProfileForm
          organizationName={organizationProfile.name}
          logoUrl={organizationProfile.logoUrl}
        />
      ) : null}

      <GlassCard className="glass-card p-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
            Suas organizações
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Troque de contexto no estilo perfil. Criar uma nova equipe não troca automaticamente.
          </p>
        </div>
        <div className="mt-4">
          <OrganizationList
            memberships={memberships}
            currentMembershipId={session?.membershipId}
            emptyHint={
              isAdminArea
                ? 'Nenhuma organização ainda. Use Criar equipe para começar.'
                : 'Nenhuma participação ainda. Crie uma equipe ou entre com um código de convite.'
            }
          />
        </div>
        {isAdminArea && showCreateTeam ? (
          <div className="mt-4 flex justify-start">
            <CreateOrganizationForm isFirstOrganization={isFirstOrganization} />
          </div>
        ) : null}
      </GlassCard>

      {!isAdminArea ? (
        <GlassCard className="glass-card p-5">
          <div className="space-y-6">
            {showCreateTeam ? <CreateOrganizationForm isFirstOrganization={isFirstOrganization} /> : null}
            {canJoinTeam ? <JoinOrganizationPanel /> : null}
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}
