'use client';

import { useActionState } from 'react';
import {
  createRoleAction,
  deleteRoleAction,
  saveDayRequirementAction,
} from '@/modules/scheduling/actions';
import { Alert, Field, PrimaryButton } from '@/components/auth/auth-ui';
import {
  DAY_OF_WEEK_LABELS,
  DAY_OF_WEEK_ORDER,
  type DayRequirementSummary,
  type RoleSummary,
} from '@/modules/scheduling/types';

export function RolesAndFormationEditor({
  roles,
  dayRequirements,
}: {
  roles: RoleSummary[];
  dayRequirements: DayRequirementSummary[];
}) {
  const [state, formAction] = useActionState(createRoleAction, {});

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Funções customizadas</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Cadastre as funções usadas na formação (ex: vocal, guitarra, bateria).
        </p>

        <form action={formAction} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <Field label="Nova função" name="name" />
          </div>
          <div className="sm:self-end">
            <PrimaryButton label="Adicionar função" />
          </div>
        </form>

        {state.error ? (
          <div className="mt-3">
            <Alert message={state.error} tone="error" />
          </div>
        ) : null}
        {state.success ? (
          <div className="mt-3">
            <Alert message={state.success} tone="success" />
          </div>
        ) : null}

        <ul className="mt-4 flex flex-wrap gap-2">
          {roles.map((role) => (
            <li
              key={role.id}
              className="flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-sm"
            >
              {role.name}
              <form action={deleteRoleAction.bind(null, role.id)}>
                <button type="submit" className="text-red-700 underline">
                  remover
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Formação por dia da semana</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Defina quantas pessoas são necessárias em cada função, por dia da semana.
        </p>

        {roles.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">Cadastre ao menos uma função acima.</p>
        ) : (
          <div className="mt-4 space-y-6">
            {DAY_OF_WEEK_ORDER.map((dayOfWeek) => (
              <DayFormationBlock
                key={dayOfWeek}
                dayOfWeek={dayOfWeek}
                roles={roles}
                dayRequirements={dayRequirements.filter((item) => item.dayOfWeek === dayOfWeek)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DayFormationBlock({
  dayOfWeek,
  roles,
  dayRequirements,
}: {
  dayOfWeek: (typeof DAY_OF_WEEK_ORDER)[number];
  roles: RoleSummary[];
  dayRequirements: DayRequirementSummary[];
}) {
  const requirementMap = new Map(dayRequirements.map((item) => [item.roleId, item.quantity]));

  return (
    <div className="rounded-xl border border-zinc-100 p-4">
      <h3 className="font-medium text-zinc-900">{DAY_OF_WEEK_LABELS[dayOfWeek]}</h3>
      <div className="mt-3 space-y-2">
        {roles.map((role) => (
          <form
            key={role.id}
            action={saveDayRequirementAction}
            className="flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="dayOfWeek" value={dayOfWeek} />
            <input type="hidden" name="roleId" value={role.id} />
            <label className="min-w-40 flex-1 text-sm text-zinc-700">
              {role.name}
              <input
                name="quantity"
                type="number"
                min={0}
                defaultValue={requirementMap.get(role.id) ?? 0}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
              />
            </label>
            <button type="submit" className="rounded-lg border px-3 py-2 text-sm">
              Salvar
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
