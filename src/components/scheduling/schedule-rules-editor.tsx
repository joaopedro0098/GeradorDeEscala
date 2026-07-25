'use client';

import {
  saveGeneralIntervalRuleAction,
  saveParticipationMinimumAction,
} from '@/modules/scheduling/actions';
import { Alert, Field, PrimaryButton } from '@/components/auth/auth-ui';
import { PriorityRolesList } from '@/components/scheduling/priority-roles-list';
import { useToastActionState } from '@/components/ui/success-toast';
import {
  INTERVAL_COUNT_MODE_LABELS,
  type IntervalRuleSummary,
  type PriorityRoleSummary,
} from '@/modules/scheduling/types';

export function ScheduleRulesEditor({
  generalIntervalRule,
  priorityRoles,
  participationMinimumDays,
}: {
  generalIntervalRule: IntervalRuleSummary | null;
  priorityRoles: PriorityRoleSummary[];
  participationMinimumDays: number | null;
}) {
  const [generalState, generalAction] = useToastActionState(saveGeneralIntervalRuleAction, {});
  const [participationState, participationAction] = useToastActionState(
    saveParticipationMinimumAction,
    {},
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Regra de intervalo (geral)</h2>
        <form action={generalAction} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Intervalo"
              name="intervalCount"
              type="number"
              defaultValue={String(generalIntervalRule?.intervalCount ?? 1)}
            />
            <label className="block text-sm font-medium text-zinc-800">
              Contagem
              <select
                name="countMode"
                defaultValue={generalIntervalRule?.countMode ?? 'BY_EVENT'}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                {Object.entries(INTERVAL_COUNT_MODE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {generalState.error ? <Alert message={generalState.error} tone="error" /> : null}
          <div>
            <PrimaryButton label="Salvar regra geral" fullWidth={false} />
          </div>
        </form>
      </section>

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

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Alta prioridade</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Arraste para definir a ordem das funções essenciais (1 = mais prioritária). Toda função
          cadastrada aparece aqui automaticamente.
        </p>
        <PriorityRolesList priorityRoles={priorityRoles} />
      </section>
    </div>
  );
}
