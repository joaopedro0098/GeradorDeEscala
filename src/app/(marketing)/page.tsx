import type { Metadata } from 'next';
import { LandingHome } from '@/components/marketing/landing/landing-home';
import { resolveMarketingAuthLinks } from '@/lib/marketing-auth-links';
import { getPendingLoginFromCookies, getSessionFromCookies } from '@/modules/auth/session';

export const metadata: Metadata = {
  title: 'Equipgestor — Escale sua equipe de louvor em minutos',
  description:
    'Equipgestor cria automaticamente a escala das bandas no mês, com base na disponibilidade de cada membro. Cadastre músicos, defina regras e se organize de forma mais eficiente.',
  openGraph: {
    title: 'Equipgestor — Escale sua equipe de louvor em minutos',
    description: 'Escala automática para bandas de louvor, com base na disponibilidade da equipe.',
    type: 'website',
  },
};

export default async function HomePage() {
  const session = await getSessionFromCookies();
  const pending = await getPendingLoginFromCookies();
  const auth = resolveMarketingAuthLinks(session, Boolean(pending));

  return <LandingHome auth={auth} />;
}
