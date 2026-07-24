'use client';

import { useMemo, useState, useTransition } from 'react';
import { MoreHorizontal, Search, X } from 'lucide-react';
import { demoteAdminAction, promoteMemberAction } from '@/modules/auth/actions';
import { RemoveMemberButton } from '@/components/members/remove-member-button';

const PAGE_SIZE = 20;

type ActiveMember = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isPrimaryAdmin: boolean;
  rolePreferences: { id: string; name: string; sortOrder: number }[];
  groupName: string | null;
};

export function ActiveMembersList({
  members,
  canManageAdmins,
  sessionMembershipId,
}: {
  members: ActiveMember[];
  canManageAdmins: boolean;
  sessionMembershipId: string;
}) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selectedMember, setSelectedMember] = useState<ActiveMember | null>(null);
  const shown = members.slice(0, visible);
  const hasMore = visible < members.length;

  return (
    <div>
      <ul className="divide-y divide-zinc-100">
        {shown.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-3 py-2">
            <div className="flex min-w-0 items-center gap-2 py-0.5">
              <span className="truncate text-sm font-medium text-zinc-900">{member.name}</span>
              <span className="shrink-0 text-xs text-zinc-400">
                {member.isPrimaryAdmin ? 'Admin principal' : member.isAdmin ? 'Admin' : 'Membro'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedMember(member)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
              aria-label={`Ver detalhes de ${member.name}`}
            >
              <MoreHorizontal className="h-4 w-4" />
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
          canManageAdmins={canManageAdmins}
          canRemove={selectedMember.id !== sessionMembershipId}
          onClose={() => setSelectedMember(null)}
        />
      ) : null}
    </div>
  );
}

function MemberDetailsDialog({
  member,
  canManageAdmins,
  canRemove,
  onClose,
}: {
  member: ActiveMember;
  canManageAdmins: boolean;
  canRemove: boolean;
  onClose: () => void;
}) {
  const primaryRole = member.rolePreferences[0]?.name ?? null;
  const preferences = member.rolePreferences.map((preference) => preference.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
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

        <dl className="mt-5 space-y-3 text-sm">
          <Detail label="Função" value={primaryRole ?? 'Sem função atribuída'} />
          <Detail label="E-mail" value={member.email} />
          <Detail
            label="Preferências"
            value={preferences.length > 0 ? preferences.join(', ') : 'Sem preferências'}
          />
          {member.groupName ? <Detail label="Grupo" value={member.groupName} /> : null}
        </dl>

        {canManageAdmins || canRemove ? (
          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-zinc-100 pt-4">
            {canManageAdmins && member.isAdmin && !member.isPrimaryAdmin ? (
              <form action={demoteAdminAction.bind(null, member.id)}>
                <button type="submit" className="rounded-lg border px-3 py-1.5 text-sm">
                  Remover admin
                </button>
              </form>
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
