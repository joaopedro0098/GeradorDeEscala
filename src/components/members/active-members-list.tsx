'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { MoreHorizontal, Search, X } from 'lucide-react';
import { demoteAdminAction, promoteMemberAction } from '@/modules/auth/actions';
import { RemoveMemberButton } from '@/components/members/remove-member-button';
import {
  MemberRolePreferencesEditor,
  type MemberRolePreferenceItem,
  type OrgRoleOption,
} from '@/components/members/member-role-preferences-editor';
import { showSuccessToast } from '@/components/ui/success-toast';

const PAGE_SIZE = 20;

type ActiveMember = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isPrimaryAdmin: boolean;
  rolePreferences: MemberRolePreferenceItem[];
  groupName: string | null;
};

export function ActiveMembersList({
  members,
  availableRoles,
  canManageAdmins,
  sessionMembershipId,
}: {
  members: ActiveMember[];
  availableRoles: OrgRoleOption[];
  canManageAdmins: boolean;
  sessionMembershipId: string;
}) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const shown = members.slice(0, visible);
  const hasMore = visible < members.length;

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );

  return (
    <div>
      <ul className="divide-y divide-zinc-100">
        {shown.map((member) => (
          <li key={member.id}>
            <button
              type="button"
              onClick={() => setSelectedMemberId(member.id)}
              className="flex w-full cursor-pointer items-center justify-between gap-3 py-2 text-left transition hover:bg-zinc-50"
              aria-label={`Ver detalhes de ${member.name}`}
            >
              <span className="flex min-w-0 items-center gap-2 py-0.5">
                <span className="truncate text-sm font-medium text-zinc-900">{member.name}</span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {member.isPrimaryAdmin ? 'Admin principal' : member.isAdmin ? 'Admin' : 'Membro'}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {hasMore ? (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((current) => current + PAGE_SIZE)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] underline-offset-2 transition hover:text-[var(--text-primary)] hover:underline"
          >
            Ver mais ({members.length - visible} restantes)
          </button>
        </div>
      ) : null}

      {selectedMember ? (
        <MemberDetailsDialog
          member={selectedMember}
          availableRoles={availableRoles}
          canManageAdmins={canManageAdmins}
          canRemove={selectedMember.id !== sessionMembershipId}
          onClose={() => setSelectedMemberId(null)}
        />
      ) : null}
    </div>
  );
}

function MemberDetailsDialog({
  member,
  availableRoles,
  canManageAdmins,
  canRemove,
  onClose,
}: {
  member: ActiveMember;
  availableRoles: OrgRoleOption[];
  canManageAdmins: boolean;
  canRemove: boolean;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function demote() {
    startTransition(async () => {
      await demoteAdminAction(member.id);
      showSuccessToast();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-100 px-6 py-5">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">{member.name}</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              {member.isPrimaryAdmin ? 'Admin principal' : member.isAdmin ? 'Admin' : 'Membro'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5 text-sm">
            <div>
              <p className="font-medium text-zinc-700">Função</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Busque funções cadastradas e arraste para ordenar a preferência (1 = preferida).
              </p>
              <div className="mt-3">
                <MemberRolePreferencesEditor
                  membershipId={member.id}
                  availableRoles={availableRoles}
                  initialPreferences={member.rolePreferences}
                />
              </div>
            </div>

            <Detail label="E-mail" value={member.email} />
            {member.groupName ? <Detail label="Grupo" value={member.groupName} /> : null}
          </div>
        </div>

        {canManageAdmins || canRemove ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-zinc-100 px-6 py-4">
            {canManageAdmins && member.isAdmin && !member.isPrimaryAdmin ? (
              <button
                type="button"
                disabled={isPending}
                onClick={demote}
                className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-60"
              >
                Remover admin
              </button>
            ) : null}
            {canRemove ? (
              <RemoveMemberButton membershipId={member.id} memberName={member.name} compact />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-zinc-700">{label}</dt>
      <dd className="mt-0.5 text-zinc-600">{value}</dd>
    </div>
  );
}

export function MembersCardMenu({
  members,
  canManageAdmins,
}: {
  members: ActiveMember[];
  canManageAdmins: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showPromotion, setShowPromotion] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ActiveMember | null>(null);
  const [isPending, startTransition] = useTransition();

  const candidates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return members
      .filter((member) => !member.isAdmin)
      .filter(
        (member) =>
          !normalized ||
          member.name.toLocaleLowerCase('pt-BR').includes(normalized) ||
          member.email.toLocaleLowerCase('pt-BR').includes(normalized),
      )
      .slice(0, 20);
  }, [members, query]);

  if (!canManageAdmins) return null;

  function close() {
    setOpen(false);
    setShowPromotion(false);
    setQuery('');
    setSelected(null);
  }

  function confirmPromotion() {
    if (!selected) return;
    startTransition(async () => {
      await promoteMemberAction(selected.id);
      showSuccessToast();
      close();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
        aria-label="Opções de membros"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-zinc-900">
                {showPromotion ? 'Promover membro a admin' : 'Opções de membros'}
              </h3>
              <button
                type="button"
                onClick={close}
                className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!showPromotion ? (
              <button
                type="button"
                onClick={() => setShowPromotion(true)}
                className="mt-5 w-full rounded-xl border border-zinc-200 px-4 py-3 text-left text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
              >
                Promover membro a admin
              </button>
            ) : selected ? (
              <div className="mt-5">
                <p className="text-sm leading-6 text-zinc-700">
                  Confirma promover{' '}
                  <span className="font-medium text-zinc-900">{selected.name}</span> a admin?
                </p>
                <div className="mt-6 flex gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setSelected(null)}
                    className="flex-1 rounded-lg border px-4 py-2 text-sm"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={confirmPromotion}
                    className="flex-1 rounded-lg bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {isPending ? 'Promovendo...' : 'Confirmar promoção'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por nome ou e-mail"
                    className="w-full rounded-xl border border-zinc-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                  />
                </label>
                <ul className="mt-3 max-h-64 divide-y divide-zinc-100 overflow-y-auto">
                  {candidates.map((member) => (
                    <li key={member.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(member)}
                        className="w-full px-1 py-2.5 text-left hover:bg-zinc-50"
                      >
                        <span className="block text-sm font-medium text-zinc-900">{member.name}</span>
                        <span className="block text-xs text-zinc-500">{member.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {candidates.length === 0 ? (
                  <p className="py-6 text-center text-sm text-zinc-500">
                    Nenhum membro disponível.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
