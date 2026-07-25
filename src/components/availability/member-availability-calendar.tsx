'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  getSubmitAvailabilityPreviewAction,
  submitAvailabilityAction,
  toggleAvailabilityAction,
} from '@/modules/availability/actions';
import { buildMonthGrid } from '@/modules/scheduling/configuration.logic';
import type { SubmitConfirmation } from '@/modules/availability/availability.logic';
import { formatYearMonth, type YearMonth } from '@/modules/scheduling/working-month.logic';

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

type EventItem = { id: string; date: string };

export function MemberAvailabilityCalendar({
  workingMonth,
  events,
  initialMarkedEventIds,
  minimumDays,
}: {
  workingMonth: YearMonth;
  events: EventItem[];
  initialMarkedEventIds: string[];
  minimumDays: number;
}) {
  const [markedEventIds, setMarkedEventIds] = useState(new Set(initialMarkedEventIds));
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preview, setPreview] = useState<SubmitConfirmation | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eventsByDate = useMemo(
    () => new Map(events.map((event) => [event.date, event])),
    [events],
  );
  const monthCells = useMemo(
    () => buildMonthGrid(workingMonth.year, workingMonth.month),
    [workingMonth],
  );
  const selectedDays = markedEventIds.size;

  function toggleDay(dateKey: string) {
    const event = eventsByDate.get(dateKey);
    if (!event) return;

    startTransition(async () => {
      setError(null);
      try {
        await toggleAvailabilityAction(event.id);
        setMarkedEventIds((current) => {
          const next = new Set(current);
          if (next.has(event.id)) {
            next.delete(event.id);
          } else {
            next.add(event.id);
          }
          return next;
        });
      } catch {
        setError('Não foi possível atualizar a disponibilidade.');
      }
    });
  }

  async function openSubmitDialog() {
    setError(null);
    setFeedback(null);
    const nextPreview = await getSubmitAvailabilityPreviewAction();
    setPreview(nextPreview);
    setDialogOpen(true);
  }

  async function confirmSubmit() {
    startTransition(async () => {
      const result = await submitAvailabilityAction();
      setDialogOpen(false);
      setFeedback(result.message);
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Disponibilidade de <span className="capitalize">{formatYearMonth(workingMonth)}</span>
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Selecione os dias em que você pode participar. Mínimo configurado: {minimumDays}{' '}
              dia(s).
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-zinc-700">
          Dias selecionados: <strong>{selectedDays}</strong>
        </p>

        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        {feedback ? <p className="mt-2 text-sm text-emerald-700">{feedback}</p> : null}

        <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs font-medium text-zinc-500">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {monthCells.map((dateKey, index) => {
            if (!dateKey) return <div key={`empty-${index}`} />;

            const event = eventsByDate.get(dateKey);
            const isMarked = event ? markedEventIds.has(event.id) : false;
            const isSelectable = Boolean(event);

            return (
              <button
                key={dateKey}
                type="button"
                disabled={!isSelectable || isPending}
                onClick={() => toggleDay(dateKey)}
                className={`min-h-11 rounded-lg border px-1 py-2 text-sm sm:px-2 sm:py-3 ${
                  isSelectable
                    ? isMarked
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-300 bg-white text-zinc-800'
                    : 'border-zinc-100 bg-zinc-50 text-zinc-300'
                }`}
              >
                {Number(dateKey.slice(-2))}
              </button>
            );
          })}
        </div>
      </section>

      <button
        type="button"
        disabled={isPending}
        onClick={openSubmitDialog}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        Enviar disponibilidade
      </button>

      {dialogOpen && preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">{preview.title}</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-700">{preview.message}</p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border px-4 py-2 text-sm"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
                onClick={confirmSubmit}
              >
                {preview.kind === 'below_minimum' ? 'Enviar mesmo assim' : 'Confirmar envio'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
