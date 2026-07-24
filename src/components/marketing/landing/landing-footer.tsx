import Link from 'next/link';
import { CalendarCheck } from 'lucide-react';
import type { MarketingAuthLinks } from '@/components/marketing/landing/landing-nav';

export function LandingFooter({ auth }: { auth: MarketingAuthLinks }) {
  return (
    <footer className="border-t border-border bg-muted/30 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <Link href="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <CalendarCheck className="h-4 w-4" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">Equipgestor</span>
          </Link>

          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <Link href="/como-funciona" className="transition-colors hover:text-foreground">
              Como funciona
            </Link>
            <Link href={auth.primaryHref} className="transition-colors hover:text-foreground">
              Começar
            </Link>
          </nav>

          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Equipgestor. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
