import { getAppShellContext } from '@/lib/app-shell.server';
import { redirect } from 'next/navigation';
import { GlassCard } from '@/components/ui/glass-card';

export default async function AdminHomePage() {
  const context = await getAppShellContext({ loginMode: 'admin' });
  if (!context) redirect('/login');

  if (!context.session) {
    return (
      <GlassCard className="glass-card p-6">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Bem-vindo</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Sua conta está pronta. Quando quiser começar, crie uma organização ou entre com um código em
          Organizações.
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="glass-card p-6">
      <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
        Painel administrativo
      </h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Configure eventos, formação e regras em Configurações, gerencie cadastros em Membros/Músicos e
        gere ou publique a escala do período em Escala.
      </p>
    </GlassCard>
  );
}
