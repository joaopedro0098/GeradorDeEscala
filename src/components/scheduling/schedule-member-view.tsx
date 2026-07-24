'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildMonthGrid } from '@/modules/scheduling/configuration.logic';
import {
  countBlankSlotsInEvent,
  countBlankSlotsInOverview,
  datesWithBlankSlots,
} from '@/modules/scheduling/schedule.logic';
import type { ScheduleEventView, ScheduleOverview } from '@/modules/scheduling/schedule.types';
import { DAY_OF_WEEK_LABELS } from '@/modules/scheduling/types';

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function EventScheduleCard({ event }: { event: ScheduleEventView }) {
  const blankCount = countBlankSlotsInEvent(event);
  const hasGaps = blankCount > 0;

  return (
    <div
      className={`rounded-2xl border bg-white p-5 ${
        hasGaps ? 'border-amber-300 border-l-4 border-l-amber-400' : 'border-zinc-200'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900">
          {formatDate(event.date)} · {DAY_OF_WEEK_LABELS[event.dayOfWeek]}
        </h3>
        {hasGaps ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900">
            {blankCount === 1 ? '1 vaga em aberto' : `${blankCount} vagas em aberto`}
          </span>
        ) : null}
      </div>
      <ul className="mt-3 divide-y divide-zinc-100">
        {event.slots.map((slot) => {
          const isBlank = slot.membershipId === null;
          return (
            <li key={slot.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="text-zinc-600">{slot.roleName}</span>
              <span
                className={
                  isBlank
                    ? 'rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900'
                    : 'font-medium text-zinc-900'
                }
              >
                {isBlank ? 'Vaga em aberto' : slot.memberName}
                {!isBlank && slot.isMinister ? ' · ★ Ministro' : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ScheduleMemberView({
  initialYear,
  initialMonth,
  initialSelectedDate,
  overview,
  readOnly = false,
}: {
  initialYear: number;
  initialMonth: number;
  initialSelectedDate?: string | null;
  overview: ScheduleOverview | null;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [localSelectedDate, setLocalSelectedDate] = useState<string | null>(
    initialSelectedDate ?? null,
  );

  const eventsByDate = useMemo(
    () => new Map((overview?.events ?? []).map((event) => [event.date, event])),
    [overview?.events],
  );
  const monthCells = useMemo(
    () => buildMonthGrid(initialYear, initialMonth),
    [initialYear, initialMonth],
  );
  const gapDates = useMemo(
    () => new Set(datesWithBlankSlots(overview?.events ?? [])),
    [overview?.events],
  );
  const blankSlotCount = useMemo(
    () => countBlankSlotsInOverview(overview?.events ?? []),
    [overview?.events],
  );

  const selectedDate = readOnly
    ? localSelectedDate && eventsByDate.has(localSelectedDate)
      ? localSelectedDate
      : null
    : initialSelectedDate && eventsByDate.has(initialSelectedDate)
      ? initialSelectedDate
      : null;
  const selectedEvent = selectedDate ? eventsByDate.get(selectedDate) : undefined;

  function navigateMonth(year: number, month: number, date?: string | null) {
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (date) params.set('date', date);
    router.push(`/membro/escala?${params.toString()}`);
  }

  function shiftMonth(delta: number) {
    if (readOnly) return;
    const next = new Date(Date.UTC(initialYear, initialMonth - 1 + delta, 1));
    navigateMonth(next.getUTCFullYear(), next.getUTCMonth() + 1);
  }

  function selectDate(dateKey: string) {
    if (readOnly) {
      setLocalSelectedDate((current) => (current === dateKey ? null : dateKey));
      return;
    }
    if (selectedDate === dateKey) {
      navigateMonth(initialYear, initialMonth);
      return;
    }
    navigateMonth(initialYear, initialMonth, dateKey);
  }

  const monthLabel = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(initialYear, initialMonth - 1, 1)));

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Escala do período</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Consulte quem está escalado em cada evento. Clique num dia no calendário para ver a
              escala daquele culto.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={readOnly}
              className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
              onClick={() => shiftMonth(-1)}
            >
              ‹
            </button>
            <span className="min-w-36 text-center text-sm font-medium capitalize">{monthLabel}</span>
            <button
              type="button"
              disabled={readOnly}
              className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
              onClick={() => shiftMonth(1)}
            >
              ›
            </button>
          </div>
        </div>

        {overview?.hasPublishedGaps ? (
          <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <span className="font-medium">Esta escala foi publicada com vagas em aberto.</span>{' '}
            {blankSlotCount === 1
              ? 'Há 1 vaga ainda sem pessoa escalada neste mês.'
              : `Há ${blankSlotCount} vagas ainda sem pessoa escalada neste mês.`}{' '}
            Os dias com lacunas estão destacados no calendário e nas funções afetadas abaixo.
          </p>
        ) : null}

        {overview && overview.events.length > 0 ? (
          <>
            <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs font-medium text-zinc-500">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label}>{label}</div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-2">
              {monthCells.map((dateKey, index) => {
                if (!dateKey) return <div key={`empty-${index}`} />;

                const event = eventsByDate.get(dateKey);
                const isEventDay = Boolean(event);
                const hasGaps = gapDates.has(dateKey);
                const isSelected = selectedDate === dateKey;

                return (
                  <button
                    key={dateKey}
                    type="button"
                    disabled={!isEventDay}
                    onClick={() => selectDate(dateKey)}
                    className={`relative min-h-11 rounded-lg border px-1 py-2 text-sm sm:px-2 sm:py-3 ${
                      isEventDay
                        ? isSelected
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : hasGaps
                            ? 'border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100'
                            : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50'
                        : 'cursor-default border-zinc-100 bg-zinc-50 text-zinc-300'
                    }`}
                  >
                    {Number(dateKey.slice(-2))}
                    {isEventDay && hasGaps && !isSelected ? (
                      <span
                        className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-xs text-zinc-500">
              Dias em cinza não têm evento neste mês. Dias em destaque amarelo têm vagas em aberto.
            </p>
          </>
        ) : null}
      </section>

      {overview ? (
        <>
          {selectedEvent ? (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-900">Escala do dia selecionado</h3>
                <button
                  type="button"
                  className="text-sm text-zinc-600 underline hover:text-zinc-900"
                  onClick={() =>
                    readOnly ? setLocalSelectedDate(null) : navigateMonth(initialYear, initialMonth)
                  }
                >
                  Ver todos os eventos
                </button>
              </div>
              <EventScheduleCard event={selectedEvent} />
            </section>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-900">
              {selectedEvent ? 'Todos os eventos do mês' : 'Eventos do mês'}
            </h3>
            {overview.events.length === 0 ? (
              <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
                Nenhuma vaga configurada para os dias de evento deste período.
              </p>
            ) : (
              overview.events.map((event) => (
                <EventScheduleCard key={event.eventId} event={event} />
              ))
            )}
          </section>
        </>
      ) : (
        <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          A escala deste mês ainda não foi publicada.
        </p>
      )}
    </div>
  );
}
