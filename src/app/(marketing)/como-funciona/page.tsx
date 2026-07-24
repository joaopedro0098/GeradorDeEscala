import type { Metadata } from 'next';
import { ComoFuncionaPage } from '@/components/marketing/landing/como-funciona-page';
import { resolveMarketingAuthLinks } from '@/lib/marketing-auth-links';
import { getPendingLoginFromCookies, getSessionFromCookies } from '@/modules/auth/session';

export const metadata: Metadata = {
  title: 'Como funciona — Equipgestor',
  description:
    'Entenda em três passos como o Equipgestor monta automaticamente a escala da sua banda de louvor com base na disponibilidade da equipe.',
  openGraph: {
    title: 'Como funciona — Equipgestor',
    description:
      'Cadastre a equipe, defina as regras e gere a escala em segundos com o Equipgestor.',
    type: 'website',
  },
};

export default async function ComoFuncionaRoute() {
  const session = await getSessionFromCookies();
  const pending = await getPendingLoginFromCookies();
  const auth = resolveMarketingAuthLinks(session, Boolean(pending));

  return <ComoFuncionaPage auth={auth} />;
}
