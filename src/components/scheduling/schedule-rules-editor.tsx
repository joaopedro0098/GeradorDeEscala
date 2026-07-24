'use client';

import { useActionState } from 'react';
import {
  addPriorityRoleAction,
  movePriorityRoleAction,
  removePriorityRoleAction,
  removeRoleIntervalRuleAction,
  saveGeneralIntervalRuleAction,
  saveParticipationMinimumAction,
  saveRoleIntervalRuleAction,
} from '@/modules/scheduling/actions';
import { Alert, Field, PrimaryButton } from '@/components/auth/auth-ui';
import {
  INTERVAL_COUNT_MODE_LABELS,
  type IntervalRuleSummary,
  type PriorityRoleSummary,
  type RoleSummary,
} from '@/modules/scheduling/types';

export function ScheduleRulesEditor({
  roles,
  generalIntervalRule,
  roleIntervalRules,
  priorityRoles,
  participationMinimumDays,
}: {
  roles: RoleSummary[];
  generalIntervalRule: IntervalRuleSummary | null;
  roleIntervalRules: IntervalRuleSummary[];
  priorityRoles: PriorityRoleSummary[];
  participationMinimumDays: number | null;
}) {
  const [generalState, generalAction] = useActionState(saveGeneralIntervalRuleAction, {});
  const [participationState, participationAction] = useActionState(
    saveParticipationMinimumAction,
    {},
  );

  const availablePriorityRoles = roles.filter(
    (role) => !priorityRoles.some((item) => item.roleId === role.id),
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Regra de intervalo (geral)</h2>
        <form action={generalAction} className="mt-4 grid gap-4 sm:grid-cols-3">
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
          <div className="self-end">
            <PrimaryButton label="Salvar regra geral" />
          </div>
        </form>
        {generalState.error ? (
          <div className="mt-3">
            <Alert message={generalState.error} tone="error" />
          </div>
        ) : null}
        {generalState.success ? (
          <div className="mt-3">
            <Alert message={generalState.success} tone="success" />
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Regra de intervalo por função</h2>
        {roles.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            Cadastre funções antes de configurar intervalos.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {roles.map((role) => {
              const rule = roleIntervalRules.find((item) => item.roleId === role.id);
              return (
                <form
                  key={role.id}
                  action={saveRoleIntervalRuleAction}
                  className="grid gap-3 rounded-xl border border-zinc-100 p-4 sm:grid-cols-4"
                >
                  <input type="hidden" name="roleId" value={role.id} />
                  <p className="self-center text-sm font-medium text-zinc-900">{role.name}</p>
                  <Field
                    label="Intervalo"
                    name="intervalCount"
                    type="number"
                    defaultValue={String(rule?.intervalCount ?? 1)}
                  />
                  <label className="block text-sm font-medium text-zinc-800">
                    Contagem
                    <select
                      name="countMode"
                      defaultValue={rule?.countMode ?? 'BY_EVENT'}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    >
                      {Object.entries(INTERVAL_COUNT_MODE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2 self-end">
                    <button type="submit" className="rounded-lg border px-3 py-2 text-sm">
                      Salvar
                    </button>
                    {rule ? (
                      <button
                        formAction={removeRoleIntervalRuleAction.bind(null, role.id)}
                        type="submit"
                        className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700"
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>
                </form>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Alta prioridade</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Ordem de prioridade das funções essenciais (1 = mais prioritária).
        </p>

        <ul className="mt-4 space-y-2">
          {priorityRoles.map((item, index) => (
            <li
              key={item.roleId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2"
            >
              <span className="text-sm text-zinc-800">
                {index + 1}. {item.roleName}
              </span>
              <div className="flex gap-2">
                <form action={movePriorityRoleAction.bind(null, item.roleId, 'up')}>
                  <button type="submit" className="rounded border px-2 py-1 text-xs">
                    ↑
                  </button>
                </form>
                <form action={movePriorityRoleAction.bind(null, item.roleId, 'down')}>
                  <button type="submit" className="rounded border px-2 py-1 text-xs">
                    ↓
                  </button>
                </form>
                <form action={removePriorityRoleAction.bind(null, item.roleId)}>
                  <button type="submit" className="rounded border px-2 py-1 text-xs text-red-700">
                    remover
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>

        {availablePriorityRoles.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {availablePriorityRoles.map((role) => (
              <form key={role.id} action={addPriorityRoleAction.bind(null, role.id)}>
                <button type="submit" className="rounded-full border px-3 py-1 text-sm">
                  + {role.name}
                </button>
              </form>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Mínimo de participação</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Número mínimo de dias de disponibilidade que cada usuário deve marcar no período.
        </p>
        <form action={participationAction} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="sm:w-48">
            <Field
              label="Mínimo de dias"
              name="minimumDays"
              type="number"
              defaultValue={String(participationMinimumDays ?? 0)}
            />
          </div>
          <div className="sm:self-end">
            <PrimaryButton label="Salvar mínimo" />
          </div>
        </form>
        {participationState.error ? (
          <div className="mt-3">
            <Alert message={participationState.error} tone="error" />
          </div>
        ) : null}
        {participationState.success ? (
          <div className="mt-3">
            <Alert message={participationState.success} tone="success" />
          </div>
        ) : null}
      </section>
    </div>
  );
}
