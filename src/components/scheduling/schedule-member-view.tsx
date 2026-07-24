'use client';

import { useRouter } from 'next/navigation';
import type { ScheduleOverview } from '@/modules/scheduling/schedule.types';
import { DAY_OF_WEEK_LABELS } from '@/modules/scheduling/types';

function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function ScheduleMemberView({
  initialYear,
  initialMonth,
  overview,
}: {
  initialYear: number;
  initialMonth: number;
  overview: ScheduleOverview | null;
}) {
  const router = useRouter();

  function shiftMonth(delta: number) {
    const next = new Date(Date.UTC(initialYear, initialMonth - 1 + delta, 1));
    router.push(`/membro/escala?year=${next.getUTCFullYear()}&month=${next.getUTCMonth() + 1}`);
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
            <p className="mt-1 text-sm text-zinc-600">Consulte quem está escalado em cada evento.</p>
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

        {overview?.hasPublishedGaps ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Esta escala foi publicada com algumas vagas ainda em aberto.
          </p>
        ) : null}
      </section>

      {overview ? (
        <section className="space-y-3">
          {overview.events.length === 0 ? (
            <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
              Nenhuma vaga configurada para os dias de evento deste período.
            </p>
          ) : (
            overview.events.map((event) => (
              <div key={event.eventId} className="rounded-2xl border border-zinc-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-zinc-900">
                  {formatDate(event.date)} · {DAY_OF_WEEK_LABELS[event.dayOfWeek]}
                </h3>
                <ul className="mt-3 divide-y divide-zinc-100">
                  {event.slots.map((slot) => (
                    <li key={slot.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="text-zinc-600">{slot.roleName}</span>
                      <span
                        className={
                          slot.membershipId ? 'font-medium text-zinc-900' : 'italic text-zinc-400'
                        }
                      >
                        {slot.memberName ?? 'Vaga em branco'}
                        {slot.isMinister ? ' · ★ Ministro' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      ) : (
        <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          A escala deste mês ainda não foi publicada.
        </p>
      )}
    </div>
  );
}
