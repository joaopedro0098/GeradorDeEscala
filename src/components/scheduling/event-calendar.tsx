'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setWorkingMonthAction, toggleEventDateAction } from '@/modules/scheduling/actions';
import { showSuccessToast } from '@/components/ui/success-toast';
import { buildMonthGrid } from '@/modules/scheduling/configuration.logic';
import {
  compareYearMonth,
  formatYearMonth,
  shiftYearMonth,
  type YearMonth,
} from '@/modules/scheduling/working-month.logic';

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function EventCalendar({
  workingMonth,
  earliestMonth,
  eventDates,
}: {
  workingMonth: YearMonth;
  /** Oldest month the organization may work on — the current month. */
  earliestMonth: YearMonth;
  eventDates: string[];
}) {
  const router = useRouter();
  const [selectedDates, setSelectedDates] = useState(new Set(eventDates));
  const [pendingMonth, setPendingMonth] = useState<YearMonth | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const monthCells = useMemo(
    () => buildMonthGrid(workingMonth.year, workingMonth.month),
    [workingMonth],
  );
  const canGoBack = compareYearMonth(shiftYearMonth(workingMonth, -1), earliestMonth) >= 0;

  function requestMonthChange(delta: number) {
    setError(null);
    setPendingMonth(shiftYearMonth(workingMonth, delta));
  }

  function confirmMonthChange() {
    const target = pendingMonth;
    if (!target) return;
    setPendingMonth(null);
    startTransition(async () => {
      const result = await setWorkingMonthAction(target.year, target.month);
      if (result.error) {
        setError(result.error);
        return;
      }
      showSuccessToast();
      router.refresh();
    });
  }

  function toggleDate(dateKey: string) {
    startTransition(async () => {
      setError(null);
      await toggleEventDateAction(dateKey);
      setSelectedDates((current) => {
        const next = new Set(current);
        if (next.has(dateKey)) {
          next.delete(dateKey);
        } else {
          next.add(dateKey);
        }
        return next;
      });
    });
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Calendário de eventos fixos</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Clique nos dias para marcar ou desmarcar eventos. Este é o mês de trabalho de toda a
            organização.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canGoBack || isPending}
            title={canGoBack ? undefined : 'Não é possível trabalhar em meses anteriores.'}
            className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
            onClick={() => requestMonthChange(-1)}
          >
            ‹
          </button>
          <span className="min-w-36 text-center text-sm font-medium capitalize">
            {formatYearMonth(workingMonth)}
          </span>
          <button
            type="button"
            disabled={isPending}
            className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
            onClick={() => requestMonthChange(1)}
          >
            ›
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs font-medium text-zinc-500">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {monthCells.map((dateKey, index) =>
          dateKey ? (
            <button
              key={dateKey}
              type="button"
              disabled={isPending}
              onClick={() => toggleDate(dateKey)}
              className={`rounded-lg border px-2 py-3 text-sm transition-colors ${
                selectedDates.has(dateKey)
                  ? 'text-slate-800'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-800'
              }`}
              style={
                selectedDates.has(dateKey)
                  ? {
                      backgroundColor: 'rgba(74, 222, 128, 0.28)',
                      borderColor: 'rgba(34, 197, 94, 0.45)',
                    }
                  : undefined
              }
            >
              {Number(dateKey.slice(-2))}
            </button>
          ) : (
            <div key={`empty-${index}`} />
          ),
        )}
      </div>

      {pendingMonth ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">Trocar o mês de trabalho?</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-700">
              Escala e disponibilidade de todos passam a usar{' '}
              <span className="font-medium capitalize">{formatYearMonth(pendingMonth)}</span>. Quem
              estiver marcando disponibilidade vai trocar de mês na hora — o que já foi enviado
              continua salvo.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border px-4 py-2 text-sm"
                onClick={() => setPendingMonth(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
                onClick={confirmMonthChange}
              >
                Trocar mês
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
