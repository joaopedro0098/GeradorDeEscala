import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/modules/auth/session';
import type { SessionPayload } from '@/modules/auth/types';
import { getPendingLoginFromCookies } from '@/modules/auth/session';

export async function requireSession(options?: {
  loginMode?: 'user' | 'admin';
}): Promise<SessionPayload> {
  const session = await getSessionFromCookies();
  if (!session) {
    const pending = await getPendingLoginFromCookies();
    if (pending) redirect('/admin/organizacoes');
    redirect('/login');
  }

  if (options?.loginMode && session.loginMode !== options.loginMode) {
    redirect(options.loginMode === 'admin' ? '/membro/escala' : '/admin/escala');
  }

  return session;
}
