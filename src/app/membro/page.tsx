import { GlassCard } from '@/components/ui/glass-card';

export default function MemberHomePage() {
  return (
    <GlassCard className="glass-card p-6">
      <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Área do membro</h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Marque sua disponibilidade na aba Disponibilidade e consulte a escala publicada na aba Escala.
      </p>
    </GlassCard>
  );
}
