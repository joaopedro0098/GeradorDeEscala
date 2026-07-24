import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/modules/auth/session';
import type { SessionPayload } from '@/modules/auth/types';

export async function requireSession(options?: {
  loginMode?: 'user' | 'admin';
}): Promise<SessionPayload> {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect('/login');
  }

  if (options?.loginMode && session.loginMode !== options.loginMode) {
    redirect(options.loginMode === 'admin' ? '/membro' : '/admin');
  }

  return session;
}
