'use client';

import Link from 'next/link';
import { CalendarCheck, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export type MarketingAuthLinks = {
  primaryHref: string;
  primaryLabel: string;
  navHref: string;
  navLabel: string;
  isSignup?: boolean;
};

export function LandingNav({ auth }: { auth: MarketingAuthLinks }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const links = [{ label: 'Como funciona', href: '/como-funciona' }];

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 w-full transition-colors duration-200 ${
          scrolled
            ? 'border-b border-border/30 bg-background/70 backdrop-blur-xl'
            : 'border-b border-transparent bg-background/40 backdrop-blur-md'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <CalendarCheck className="h-4 w-4" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-foreground">
              Equipgestor
            </span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <nav className="flex items-center gap-6">
              {links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-base font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <Link
              href={auth.navHref}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
            >
              {auth.navLabel}
            </Link>
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-foreground md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileOpen ? (
          <div className="border-t border-border/40 bg-background/90 px-4 py-4 backdrop-blur-xl md:hidden">
            <nav className="flex flex-col gap-3">
              {links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-base font-medium text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href={auth.navHref}
                className="mt-2 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
                onClick={() => setMobileOpen(false)}
              >
                {auth.navLabel}
              </Link>
            </nav>
          </div>
        ) : null}
      </header>

      {/* Espaço para o conteúdo não ficar atrás da barra fixa */}
      <div className="h-16 shrink-0" aria-hidden="true" />
    </>
  );
}
