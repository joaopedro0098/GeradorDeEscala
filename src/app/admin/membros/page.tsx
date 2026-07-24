import { redirect } from 'next/navigation';
import {
  approveMemberAction,
  demoteAdminAction,
  getMembersPageData,
  promoteMemberAction,
  rejectMemberAction,
  removeMemberAction,
} from '@/modules/auth/actions';
import { canManageAdminRoles } from '@/modules/auth/permissions';

export default async function AdminMembersPage() {
  const data = await getMembersPageData();
  if (!data) redirect('/login');

  const { pending, active, session } = data;
  const canManageAdmins = canManageAdminRoles(session);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Solicitações pendentes</h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">Nenhuma solicitação pendente.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {pending.map((membership) => (
              <li
                key={membership.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-zinc-900">{membership.user.name}</p>
                  <p className="text-sm text-zinc-600">{membership.user.email}</p>
                </div>
                <div className="flex gap-2">
                  <form action={approveMemberAction.bind(null, membership.id)}>
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white"
                    >
                      Aceitar
                    </button>
                  </form>
                  <form action={rejectMemberAction.bind(null, membership.id)}>
                    <button
                      type="submit"
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white"
                    >
                      Recusar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Membros ativos</h2>
        <ul className="mt-4 space-y-3">
          {active.map((membership) => (
            <li
              key={membership.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-3"
            >
              <div>
                <p className="font-medium text-zinc-900">{membership.user.name}</p>
                <p className="text-sm text-zinc-600">{membership.user.email}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {membership.isPrimaryAdmin
                    ? 'Admin principal'
                    : membership.isAdmin
                      ? 'Admin'
                      : 'Membro'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canManageAdmins && !membership.isAdmin ? (
                  <form action={promoteMemberAction.bind(null, membership.id)}>
                    <button type="submit" className="rounded-lg border px-3 py-1.5 text-sm">
                      Promover a admin
                    </button>
                  </form>
                ) : null}
                {canManageAdmins && membership.isAdmin && !membership.isPrimaryAdmin ? (
                  <form action={demoteAdminAction.bind(null, membership.id)}>
                    <button type="submit" className="rounded-lg border px-3 py-1.5 text-sm">
                      Remover admin
                    </button>
                  </form>
                ) : null}
                {membership.id !== session.membershipId ? (
                  <form action={removeMemberAction.bind(null, membership.id)}>
                    <button
                      type="submit"
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700"
                    >
                      Excluir
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
