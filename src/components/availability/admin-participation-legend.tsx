'use client';

import { useRouter } from 'next/navigation';
import {
  PARTICIPATION_STATUS_LABELS,
  PARTICIPATION_STATUS_STYLES,
  type MemberParticipationSummary,
} from '@/modules/availability/availability.logic';

export function AdminParticipationLegend({
  initialYear,
  initialMonth,
  minimumDays,
  summaries,
}: {
  initialYear: number;
  initialMonth: number;
  minimumDays: number;
  summaries: MemberParticipationSummary[];
}) {
  const router = useRouter();

  function shiftMonth(delta: number) {
    const next = new Date(Date.UTC(initialYear, initialMonth - 1 + delta, 1));
    router.push(
      `/admin/disponibilidade?year=${next.getUTCFullYear()}&month=${next.getUTCMonth() + 1}`,
    );
  }

  const monthLabel = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(initialYear, initialMonth - 1, 1)));

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Participação no período</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Legenda para uso antes de gerar a escala. Mínimo configurado: {minimumDays} dia(s).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => shiftMonth(-1)}>
            ‹
          </button>
          <span className="min-w-36 text-center text-sm font-medium capitalize">{monthLabel}</span>
          <button type="button" className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => shiftMonth(1)}>
            ›
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {Object.entries(PARTICIPATION_STATUS_LABELS).map(([status, label]) => (
          <span
            key={status}
            className={`rounded-full border px-3 py-1 ${PARTICIPATION_STATUS_STYLES[status as keyof typeof PARTICIPATION_STATUS_STYLES]}`}
          >
            {label}
          </span>
        ))}
      </div>

      <ul className="mt-5 space-y-2">
        {summaries.map((summary) => (
          <li
            key={summary.membershipId}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 ${PARTICIPATION_STATUS_STYLES[summary.status]}`}
          >
            <span className="font-medium">{summary.memberName}</span>
            <span className="text-sm">
              {summary.markedDays} dia(s) marcado(s) · {PARTICIPATION_STATUS_LABELS[summary.status]}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-zinc-500">
        Membros sem nenhuma marcação ficam de fora da escala do período.
      </p>
    </section>
  );
}
