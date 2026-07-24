import { Figtree, Outfit } from 'next/font/google';
import type { ReactNode } from 'react';
import { LandingNav } from '@/components/marketing/landing/landing-nav';
import { resolveMarketingAuthLinks } from '@/lib/marketing-auth-links';
import { getPendingLoginFromCookies, getSessionFromCookies } from '@/modules/auth/session';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-display-marketing',
  display: 'swap',
});

const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-body-marketing',
  display: 'swap',
});

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const session = await getSessionFromCookies();
  const pending = await getPendingLoginFromCookies();
  const auth = resolveMarketingAuthLinks(session, Boolean(pending));

  return (
    <div className={`marketing-shell min-h-screen ${outfit.variable} ${figtree.variable}`}>
      <LandingNav auth={auth} />
      {children}
    </div>
  );
}
