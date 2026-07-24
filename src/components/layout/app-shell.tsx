import Link from 'next/link';
import type { ReactNode } from 'react';
import { logoutAction } from '@/modules/auth/actions';
import { canViewPlans } from '@/modules/auth/permissions';
import type { SessionPayload } from '@/modules/auth/types';

export function AppShell({
  session,
  title,
  children,
}: {
  session: SessionPayload;
  title: string;
  children: ReactNode;
}) {
  const isAdmin = session.loginMode === 'admin';
  const basePath = isAdmin ? '/admin' : '/membro';

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              {isAdmin ? 'Área do Admin' : 'Área do Usuário'}
            </p>
            <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-zinc-700 underline">
              Sair
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-4 overflow-x-auto px-4 pb-3 text-sm">
          <Link href={basePath} className="text-zinc-700 hover:text-zinc-900">
            Início
          </Link>
          {isAdmin ? (
            <>
              <Link href="/admin/configuracoes" className="text-zinc-700 hover:text-zinc-900">
                Configurações
              </Link>
              <Link href="/admin/disponibilidade" className="text-zinc-700 hover:text-zinc-900">
                Disponibilidade
              </Link>
              <Link href="/admin/membros" className="text-zinc-700 hover:text-zinc-900">
                Membros/Músicos
              </Link>
              <Link href="/admin/eventos" className="text-zinc-700 hover:text-zinc-900">
                Eventos
              </Link>
              {canViewPlans(session) ? (
                <Link href="/admin/planos" className="text-zinc-700 hover:text-zinc-900">
                  Planos
                </Link>
              ) : null}
            </>
          ) : (
            <Link href="/membro/disponibilidade" className="text-zinc-700 hover:text-zinc-900">
              Disponibilidade
            </Link>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
