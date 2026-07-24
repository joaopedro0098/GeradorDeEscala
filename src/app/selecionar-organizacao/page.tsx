import { redirect } from 'next/navigation';
import { selectOrganizationAction, getOrganizationSelectionData } from '@/modules/auth/actions';
import { AuthShell, PrimaryButton } from '@/components/auth/auth-ui';

export default async function SelectOrganizationPage() {
  const data = await getOrganizationSelectionData();
  if (!data) redirect('/login');
  if (data.memberships.length === 0) redirect('/login');

  return (
    <AuthShell title="Selecionar organização" subtitle="Escolha em qual organização deseja entrar.">
      <form action={selectOrganizationAction} className="space-y-3">
        {data.memberships.map((membership) => (
          <label
            key={membership.id}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 px-3 py-3"
          >
            <input type="radio" name="membershipId" value={membership.id} required />
            <span>
              <span className="block text-sm font-medium text-zinc-900">
                {membership.organizationName}
              </span>
              <span className="text-xs text-zinc-500">{membership.inviteCode}</span>
            </span>
          </label>
        ))}
        <PrimaryButton label="Continuar" />
      </form>
    </AuthShell>
  );
}
