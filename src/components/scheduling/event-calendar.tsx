'use client';

import { useMemo, useState, useTransition } from 'react';
import { toggleEventDateAction } from '@/modules/scheduling/actions';
import { buildMonthGrid } from '@/modules/scheduling/configuration.logic';

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function EventCalendar({
  initialYear,
  initialMonth,
  eventDates,
}: {
  initialYear: number;
  initialMonth: number;
  eventDates: string[];
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selectedDates, setSelectedDates] = useState(new Set(eventDates));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const monthCells = useMemo(() => buildMonthGrid(year, month), [year, month]);

  function shiftMonth(delta: number) {
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(next.getUTCFullYear());
    setMonth(next.getUTCMonth() + 1);
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

  const monthLabel = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Calendário de eventos fixos</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Clique nos dias para marcar ou desmarcar eventos do período.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border px-3 py-1.5 text-sm"
            onClick={() => shiftMonth(-1)}
          >
            ‹
          </button>
          <span className="min-w-36 text-center text-sm font-medium capitalize">{monthLabel}</span>
          <button
            type="button"
            className="rounded-lg border px-3 py-1.5 text-sm"
            onClick={() => shiftMonth(1)}
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
    </section>
  );
}
