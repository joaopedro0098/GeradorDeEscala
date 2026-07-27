import { NextResponse, type NextRequest } from 'next/server';
import {
  createPendingLoginToken,
  createSessionToken,
  getAuthCookieOptions,
  pendingLoginCookieName,
  pendingLoginMaxAgeSeconds,
  sessionCookieName,
  sessionMaxAgeSeconds,
  shouldRefreshAuthToken,
  verifyPendingLoginToken,
  verifySessionToken,
} from '@/modules/auth/session-token';
import type { SessionPayload } from '@/modules/auth/types';

const publicPaths = ['/login', '/cadastro'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  if (pathname === '/organizacoes') {
    return NextResponse.redirect(new URL('/admin/organizacoes', request.url));
  }

  const isAdminRoute = pathname.startsWith('/admin');
  const isMemberRoute = pathname.startsWith('/membro');

  if (!isAdminRoute && !isMemberRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get(sessionCookieName)?.value;
  const pendingToken = request.cookies.get(pendingLoginCookieName)?.value;

  if (isAdminRoute) {
    if (token) {
      const session = await verifySessionToken(token);
      if (!session) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
      if (session.loginMode !== 'admin') {
        return NextResponse.redirect(new URL('/membro/escala', request.url));
      }

      const response = NextResponse.next();
      if (shouldRefreshAuthToken(token)) {
        const refreshedToken = await createSessionToken(session);
        response.cookies.set(sessionCookieName, refreshedToken, getAuthCookieOptions(sessionMaxAgeSeconds));
      }
      return response;
    }

    if (pendingToken) {
      const pending = await verifyPendingLoginToken(pendingToken);
      if (pending) {
        const response = NextResponse.next();
        if (shouldRefreshAuthToken(pendingToken)) {
          const refreshedToken = await createPendingLoginToken(pending);
          response.cookies.set(
            pendingLoginCookieName,
            refreshedToken,
            getAuthCookieOptions(pendingLoginMaxAgeSeconds),
          );
        }
        return response;
      }
    }

    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (session.loginMode !== 'user') {
    return NextResponse.redirect(new URL('/admin/escala', request.url));
  }

  const response = NextResponse.next();
  if (shouldRefreshAuthToken(token)) {
    const refreshedToken = await createSessionToken(session);
    response.cookies.set(sessionCookieName, refreshedToken, getAuthCookieOptions(sessionMaxAgeSeconds));
  }
  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/membro/:path*', '/organizacoes'],
};
