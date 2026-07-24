import type { TrialProgress } from '@/modules/organizations/subscription.logic';
import { TRIAL_DAYS } from '@/modules/organizations/subscription.logic';
import { GlassCard } from '@/components/ui/glass-card';

export function TrialProgressBar({ progress }: { progress: TrialProgress }) {
  if (progress.isExpired) return null;

  return (
    <GlassCard className="glass-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Período de teste</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          {progress.daysRemaining} {progress.daysRemaining === 1 ? 'dia restante' : 'dias restantes'}
        </p>
      </div>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Você tem {TRIAL_DAYS} dias para usar tudo. Depois, será necessário assinar um plano para gerar
        escalas.
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200/70">
        <div
          className="h-full rounded-full bg-[var(--btn-primary-bg)] transition-all"
          style={{ width: `${progress.percentComplete}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-[var(--text-secondary)]">
        Dia {Math.min(TRIAL_DAYS, progress.daysElapsed + 1)} de {TRIAL_DAYS}
      </p>
    </GlassCard>
  );
}
