import { redirect } from 'next/navigation';
import { getMembersPageData } from '@/modules/auth/actions';
import { canManageAdminRoles } from '@/modules/auth/permissions';
import {
  ActiveMembersList,
  MembersCardMenu,
} from '@/components/members/active-members-list';
import { PendingMemberActions } from '@/components/members/pending-member-actions';

export default async function AdminMembersPage() {
  const data = await getMembersPageData();
  if (!data) redirect('/login');

  const { pending, active, session, roles } = data;
  const canManageAdmins = canManageAdminRoles(session);
  const availableRoles = roles.map((role) => ({ id: role.id, name: role.name }));
  const activeMembers = active.map((membership) => ({
    id: membership.id,
    name: membership.user.name,
    email: membership.user.email,
    isAdmin: membership.isAdmin,
    isPrimaryAdmin: membership.isPrimaryAdmin,
    rolePreferences: membership.rolePreferences.map((preference) => ({
      id: preference.role.id,
      name: preference.role.name,
      sortOrder: preference.sortOrder,
    })),
  }));

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
                <PendingMemberActions membershipId={membership.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">
            Membros ativos{' '}
            <span className="text-sm font-normal text-zinc-400">({active.length})</span>
          </h2>
          <MembersCardMenu members={activeMembers} canManageAdmins={canManageAdmins} />
        </div>
        <div className="mt-4">
          <ActiveMembersList
            members={activeMembers}
            availableRoles={availableRoles}
            canManageAdmins={canManageAdmins}
            sessionMembershipId={session.membershipId}
          />
        </div>
      </section>
    </div>
  );
}
