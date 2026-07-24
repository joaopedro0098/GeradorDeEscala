import { SignJWT, jwtVerify } from 'jose';
import type { PendingLoginPayload, SessionPayload } from './types';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const PENDING_LOGIN_MAX_AGE_SECONDS = SESSION_MAX_AGE_SECONDS;

export function getAuthCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export function getSessionSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is not configured');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSessionSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecretKey());
    const session = payload as unknown as SessionPayload;
    return {
      ...session,
      organizationLogoUrl: session.organizationLogoUrl ?? null,
    };
  } catch {
    return null;
  }
}

export async function createPendingLoginToken(payload: PendingLoginPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_LOGIN_MAX_AGE_SECONDS}s`)
    .sign(getSessionSecretKey());
}

export async function verifyPendingLoginToken(token: string): Promise<PendingLoginPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecretKey());
    return payload as unknown as PendingLoginPayload;
  } catch {
    return null;
  }
}

export const sessionCookieName = 'session';
export const pendingLoginCookieName = 'pending_login';
export const sessionMaxAgeSeconds = SESSION_MAX_AGE_SECONDS;
export const pendingLoginMaxAgeSeconds = PENDING_LOGIN_MAX_AGE_SECONDS;
