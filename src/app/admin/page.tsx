import { getAppShellContext } from '@/lib/app-shell.server';
import { redirect } from 'next/navigation';

export default async function AdminHomePage() {
  const context = await getAppShellContext({ loginMode: 'admin' });
  if (!context) redirect('/login');

  if (!context.session) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Bem-vindo</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Sua conta está pronta. Quando quiser começar, crie uma organização ou entre com um código em Organizações.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-zinc-900">Painel administrativo</h2>
      <p className="mt-2 text-sm text-zinc-600">
        Configure eventos, formação e regras em Configurações, gerencie cadastros em Membros/Músicos e gere ou
        publique a escala do período em Escala.
      </p>
    </section>
  );
}
