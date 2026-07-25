import {
  PARTICIPATION_STATUS_LABELS,
  PARTICIPATION_STATUS_STYLES,
  type MemberParticipationSummary,
} from '@/modules/availability/availability.logic';
import { formatYearMonth, type YearMonth } from '@/modules/scheduling/working-month.logic';

export function AdminParticipationLegend({
  workingMonth,
  minimumDays,
  summaries,
}: {
  workingMonth: YearMonth;
  minimumDays: number;
  summaries: MemberParticipationSummary[];
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">
            Participação em <span className="capitalize">{formatYearMonth(workingMonth)}</span>
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Legenda para uso antes de gerar a escala. Mínimo configurado: {minimumDays} dia(s).
          </p>
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
