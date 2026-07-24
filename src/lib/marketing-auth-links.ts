import type { SessionPayload } from '@/modules/auth/types';
import type { MarketingAuthLinks } from '@/components/marketing/landing/landing-nav';

export function resolveMarketingAuthLinks(
  session: SessionPayload | null,
  hasPendingLogin: boolean,
): MarketingAuthLinks {
  if (session) {
    const appHref = session.loginMode === 'admin' ? '/admin/escala' : '/membro/escala';
    return {
      primaryHref: appHref,
      primaryLabel: 'Ir para minha área',
      navHref: appHref,
      navLabel: 'Ir para minha área',
      isSignup: false,
    };
  }

  if (hasPendingLogin) {
    return {
      primaryHref: '/admin/organizacoes',
      primaryLabel: 'Ir para minha área',
      navHref: '/admin/organizacoes',
      navLabel: 'Ir para minha área',
      isSignup: false,
    };
  }

  return {
    primaryHref: '/cadastro',
    primaryLabel: 'Começar agora',
    navHref: '/login',
    navLabel: 'Entrar',
    isSignup: true,
  };
}
