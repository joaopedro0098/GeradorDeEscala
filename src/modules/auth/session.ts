import { cookies } from 'next/headers';
import type { LoginMode, PendingLoginPayload, SessionPayload } from './types';
import {
  createPendingLoginToken,
  createSessionToken,
  getAuthCookieOptions,
  pendingLoginCookieName,
  pendingLoginMaxAgeSeconds,
  sessionCookieName,
  sessionMaxAgeSeconds,
  verifyPendingLoginToken,
  verifySessionToken,
} from './session-token';

export {
  createPendingLoginToken,
  createSessionToken,
  verifyPendingLoginToken,
  verifySessionToken,
} from './session-token';

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, getAuthCookieOptions(sessionMaxAgeSeconds));
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) return null;

  return verifySessionToken(token);
}

export async function setPendingLoginCookie(payload: PendingLoginPayload): Promise<void> {
  const token = await createPendingLoginToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(pendingLoginCookieName, token, getAuthCookieOptions(pendingLoginMaxAgeSeconds));
}

export async function getPendingLoginFromCookies(): Promise<PendingLoginPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(pendingLoginCookieName)?.value;
  if (!token) return null;

  return verifyPendingLoginToken(token);
}

export async function clearPendingLoginCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(pendingLoginCookieName);
}

export function getDefaultRedirectForLoginMode(loginMode: LoginMode): string {
  return loginMode === 'admin' ? '/admin/escala' : '/membro/escala';
}
