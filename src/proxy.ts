import { NextResponse, type NextRequest } from 'next/server';
import { sessionCookieName, verifySessionToken } from '@/modules/auth/session-token';

const publicPaths = ['/login', '/cadastro'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const isAdminRoute = pathname.startsWith('/admin');
  const isMemberRoute = pathname.startsWith('/membro');

  if (!isAdminRoute && !isMemberRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAdminRoute && session.loginMode !== 'admin') {
    return NextResponse.redirect(new URL('/membro', request.url));
  }

  if (isMemberRoute && session.loginMode !== 'user') {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/membro/:path*'],
};
