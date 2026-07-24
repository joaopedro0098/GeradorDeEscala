import { cookies } from 'next/headers';
import type { LoginMode, PendingLoginPayload, SessionPayload } from './types';
import {
  createPendingLoginToken,
  createSessionToken,
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
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionMaxAgeSeconds,
  });
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
  cookieStore.set(pendingLoginCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: pendingLoginMaxAgeSeconds,
  });
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
  return loginMode === 'admin' ? '/admin' : '/membro';
}
