import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth.server';
import { canViewPlans } from '@/modules/auth/permissions';

export default async function AdminPlansPage() {
  const session = await requireSession({ loginMode: 'admin' });
  if (!canViewPlans(session)) {
    redirect('/admin');
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-zinc-900">Planos</h2>
      <p className="mt-2 text-sm text-zinc-600">
        Esta aba está reservada para definição futura de planos e permanece visível apenas para o
        admin principal.
      </p>
    </section>
  );
}
