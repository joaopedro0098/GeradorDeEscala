import Link from 'next/link';
import { getSessionFromCookies } from '@/modules/auth/session';

export default async function HomePage() {
  const session = await getSessionFromCookies();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Gerador de Escala</h1>
      <p className="mt-3 max-w-md text-balance text-zinc-600">
        Sistema de geração automática de escalas para organizações.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {session ? (
          <Link
            href={session.loginMode === 'admin' ? '/admin' : '/membro'}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            Ir para minha área
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900"
            >
              Cadastrar
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
