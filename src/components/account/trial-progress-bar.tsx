import type { TrialProgress } from '@/modules/organizations/subscription.logic';
import { TRIAL_DAYS } from '@/modules/organizations/subscription.logic';

export function TrialProgressBar({ progress }: { progress: TrialProgress }) {
  if (progress.isExpired) return null;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900">Período de teste</h2>
        <p className="text-sm text-zinc-600">
          {progress.daysRemaining} {progress.daysRemaining === 1 ? 'dia restante' : 'dias restantes'}
        </p>
      </div>
      <p className="mt-2 text-sm text-zinc-600">
        Você tem {TRIAL_DAYS} dias para usar tudo. Depois, será necessário assinar um plano para gerar escalas.
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-zinc-900 transition-all"
          style={{ width: `${progress.percentComplete}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Dia {Math.min(TRIAL_DAYS, progress.daysElapsed + 1)} de {TRIAL_DAYS}
      </p>
    </section>
  );
}
