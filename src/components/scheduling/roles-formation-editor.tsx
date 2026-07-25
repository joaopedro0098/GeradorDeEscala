'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  createRoleAction,
  deleteRoleAction,
} from '@/modules/scheduling/actions';
import { Alert, Field, PrimaryButton } from '@/components/auth/auth-ui';
import { DayFormationPriorityList } from '@/components/scheduling/day-formation-priority-list';
import { showSuccessToast, useToastActionState } from '@/components/ui/success-toast';
import { getDayOfWeekFromDateKey } from '@/modules/scheduling/configuration.logic';
import {
  DAY_OF_WEEK_ORDER,
  type DayRequirementSummary,
  type PriorityRoleSummary,
  type RoleSummary,
} from '@/modules/scheduling/types';
import type { YearMonth } from '@/modules/scheduling/working-month.logic';
import type { DayOfWeek } from '@/generated/prisma/client';

const DAY_FILTER_LABELS: Record<DayOfWeek, string> = {
  SUNDAY: 'Domingo',
  MONDAY: 'Segunda',
  TUESDAY: 'Terça',
  WEDNESDAY: 'Quarta',
  THURSDAY: 'Quinta',
  FRIDAY: 'Sexta',
  SATURDAY: 'Sábado',
};

function weekdaysFromWorkingMonthEvents(
  eventDates: string[],
  workingMonth: YearMonth,
): DayOfWeek[] {
  const prefix = `${workingMonth.year}-${String(workingMonth.month).padStart(2, '0')}-`;
  const present = new Set<DayOfWeek>();

  for (const dateKey of eventDates) {
    if (!dateKey.startsWith(prefix)) continue;
    present.add(getDayOfWeekFromDateKey(dateKey));
  }

  return DAY_OF_WEEK_ORDER.filter((day) => present.has(day));
}

export function RolesAndFormationEditor({
  roles,
  dayRequirements,
  priorityRoles,
  eventDates,
  workingMonth,
}: {
  roles: RoleSummary[];
  dayRequirements: DayRequirementSummary[];
  priorityRoles: PriorityRoleSummary[];
  eventDates: string[];
  workingMonth: YearMonth;
}) {
  const [state, formAction] = useToastActionState(createRoleAction, {});
  const activeWeekdays = useMemo(
    () => weekdaysFromWorkingMonthEvents(eventDates, workingMonth),
    [eventDates, workingMonth],
  );
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | null>(activeWeekdays[0] ?? null);

  useEffect(() => {
    if (activeWeekdays.length === 0) {
      setSelectedDay(null);
      return;
    }
    setSelectedDay((current) =>
      current && activeWeekdays.includes(current) ? current : activeWeekdays[0],
    );
  }, [activeWeekdays]);

  const orderedPriorityRoles = useMemo(() => {
    if (priorityRoles.length > 0) return priorityRoles;
    return roles.map((role, index) => ({
      roleId: role.id,
      roleName: role.name,
      sortOrder: index + 1,
    }));
  }, [priorityRoles, roles]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Funções customizadas</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Cadastre as funções usadas na formação (ex: vocal, guitarra, bateria).
        </p>

        <form action={formAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Nova função" name="name" />
          </div>
          <div>
            <PrimaryButton label="Adicionar função" fullWidth={false} />
          </div>
        </form>

        {state.error ? (
          <div className="mt-3">
            <Alert message={state.error} tone="error" />
          </div>
        ) : null}

        <ul className="mt-4 flex flex-wrap gap-2">
          {roles.map((role) => (
            <li
              key={role.id}
              className="flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-sm"
            >
              {role.name}
              <DeleteRoleButton roleId={role.id} />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        {activeWeekdays.length > 0 ? (
          <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {activeWeekdays.map((dayOfWeek) => (
              <button
                key={dayOfWeek}
                type="button"
                onClick={() => setSelectedDay(dayOfWeek)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm transition-colors ${
                  selectedDay === dayOfWeek
                    ? 'bg-zinc-900 text-white'
                    : 'border border-zinc-300 text-zinc-700 hover:border-zinc-400'
                }`}
              >
                {DAY_FILTER_LABELS[dayOfWeek]}
              </button>
            ))}
          </div>
        ) : null}

        <h2 className="text-lg font-semibold text-zinc-900">
          Formação por dia da semana e prioridade
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Arraste para definir a prioridade das funções (1 = mais prioritária). Use o lápis para
          informar quantas pessoas ocupam cada função neste dia da semana.
        </p>

        {activeWeekdays.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">
            Marque ao menos um dia no Calendário para configurar a formação.
          </p>
        ) : roles.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">Cadastre ao menos uma função acima.</p>
        ) : selectedDay ? (
          <div className="mt-4">
            <DayFormationPriorityList
              key={selectedDay}
              dayOfWeek={selectedDay}
              priorityRoles={orderedPriorityRoles}
              dayRequirements={dayRequirements.filter((item) => item.dayOfWeek === selectedDay)}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function DeleteRoleButton({ roleId }: { roleId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      className="text-red-700 underline disabled:opacity-60"
      onClick={() => {
        startTransition(async () => {
          await deleteRoleAction(roleId);
          showSuccessToast();
        });
      }}
    >
      remover
    </button>
  );
}
