'use client';

import { saveParticipationMinimumAction } from '@/modules/scheduling/actions';
import { Alert, Field, PrimaryButton } from '@/components/auth/auth-ui';
import { useToastActionState } from '@/components/ui/success-toast';

export function ScheduleRulesEditor({
  participationMinimumDays,
}: {
  participationMinimumDays: number | null;
}) {
  const [participationState, participationAction] = useToastActionState(
    saveParticipationMinimumAction,
    {},
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Mínimo de participação</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Número mínimo de dias de disponibilidade que cada usuário deve marcar no período.
        </p>
        <form action={participationAction} className="mt-4 space-y-4">
          <div className="max-w-xs">
            <Field
              label="Mínimo de dias"
              name="minimumDays"
              type="number"
              defaultValue={String(participationMinimumDays ?? 0)}
            />
          </div>
          {participationState.error ? (
            <Alert message={participationState.error} tone="error" />
          ) : null}
          <div>
            <PrimaryButton label="Salvar mínimo" fullWidth={false} />
          </div>
        </form>
      </section>
    </div>
  );
}
