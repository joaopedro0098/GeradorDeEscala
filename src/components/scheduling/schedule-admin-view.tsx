'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  generateScheduleAction,
  publishScheduleAction,
  setScheduleSlotMinisterAction,
  undoLastGenerationAction,
} from '@/modules/scheduling/actions';
import {
  GENERATION_STATUS_LABELS,
  type ScheduleOverview,
  type ShortageEntryView,
} from '@/modules/scheduling/schedule.types';
import { DAY_OF_WEEK_LABELS } from '@/modules/scheduling/types';

function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function ScheduleAdminView({
  initialYear,
  initialMonth,
  overview,
  shortagePreview,
}: {
  initialYear: number;
  initialMonth: number;
  overview: ScheduleOverview | null;
  shortagePreview: ShortageEntryView[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function shiftMonth(delta: number) {
    const next = new Date(Date.UTC(initialYear, initialMonth - 1 + delta, 1));
    router.push(`/admin/escala?year=${next.getUTCFullYear()}&month=${next.getUTCMonth() + 1}`);
  }

  function runGenerate() {
    setConfirmOpen(false);
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      const result = await generateScheduleAction(initialYear, initialMonth);
      if (result.error) {
        setError(result.error);
        return;
      }
      setFeedback(result.status ? GENERATION_STATUS_LABELS[result.status] : 'Escala gerada.');
      router.refresh();
    });
  }

  function handleGenerateClick() {
    setError(null);
    setFeedback(null);
    if (shortagePreview.length > 0) {
      setConfirmOpen(true);
      return;
    }
    runGenerate();
  }

  function handlePublish() {
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      const result = await publishScheduleAction(initialYear, initialMonth);
      if (result.error) {
        setError(result.error);
        return;
      }
      setFeedback(result.success ?? 'Escala publicada.');
      router.refresh();
    });
  }

  function handleToggleMinister(slotId: string) {
    setError(null);
    startTransition(async () => {
      const result = await setScheduleSlotMinisterAction(slotId, initialYear, initialMonth);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleUndo() {
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      const result = await undoLastGenerationAction(initialYear, initialMonth);
      if (result.error) {
        setError(result.error);
        return;
      }
      setFeedback(result.success ?? 'Última geração desfeita.');
      router.refresh();
    });
  }

  function formatPublishedAt(iso: string | null | undefined): string {
    if (!iso) return 'data desconhecida';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(iso));
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
              Gerar cria ou sobrescreve um rascunho; publique quando estiver pronto para os membros
              verem.
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

        {overview ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span
              className={`rounded-full border px-3 py-1 ${
                overview.status === 'PUBLISHED'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-zinc-300 bg-zinc-100 text-zinc-700'
              }`}
            >
              {overview.status === 'PUBLISHED' ? 'Publicada' : 'Rascunho'}
            </span>
            {overview.generationStatus ? (
              <span className="text-zinc-600">{GENERATION_STATUS_LABELS[overview.generationStatus]}</span>
            ) : null}
            {overview.status === 'PUBLISHED' && overview.hasPublishedGaps ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-900">
                Publicada com vagas em aberto
              </span>
            ) : null}
          </div>
        ) : null}

        {overview?.hasPendingDraft ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Rascunho gerado pelo algoritmo. Membros ainda veem a escala publicada em{' '}
            {formatPublishedAt(overview.memberVisiblePublishedAt)}. Publique para substituir.
          </p>
        ) : null}

        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        {feedback ? <p className="mt-4 text-sm text-emerald-700">{feedback}</p> : null}

        {shortagePreview.length > 0 ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">Vagas sem cobertura suficiente neste período:</p>
            <ul className="mt-2 space-y-1">
              {shortagePreview.map((entry) => (
                <li key={`${entry.eventId}-${entry.roleId}`}>
                  {formatDate(entry.eventDate)} — {entry.roleName}: faltam {entry.missing} pessoa(s) (
                  {entry.availableCandidates}/{entry.quantityNeeded} disponíveis)
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={handleGenerateClick}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {overview ? 'Regenerar escala' : 'Gerar escala'}
          </button>
          {overview && overview.status === 'DRAFT' ? (
            <button
              type="button"
              disabled={isPending}
              onClick={handlePublish}
              className="rounded-lg border border-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-60"
            >
              Publicar escala
            </button>
          ) : null}
          {overview?.hasPreviousVersion ? (
            <button
              type="button"
              disabled={isPending}
              onClick={handleUndo}
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              Desfazer última geração
            </button>
          ) : null}
        </div>
      </section>

      {overview ? (
        <>
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
                      <li
                        key={slot.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                      >
                        <span className="text-zinc-600">{slot.roleName}</span>
                        <span className="flex items-center gap-2">
                          <span
                            className={
                              slot.membershipId ? 'font-medium text-zinc-900' : 'italic text-zinc-400'
                            }
                          >
                            {slot.memberName ?? 'Vaga em branco'}
                          </span>
                          {slot.membershipId ? (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleToggleMinister(slot.id)}
                              className={`rounded-full border px-2 py-0.5 text-xs disabled:opacity-60 ${
                                slot.isMinister
                                  ? 'border-amber-400 bg-amber-100 text-amber-900'
                                  : 'border-zinc-300 text-zinc-500 hover:bg-zinc-100'
                              }`}
                            >
                              {slot.isMinister ? '★ Ministro' : 'Marcar ministro'}
                            </button>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>

          <details className="rounded-2xl border border-zinc-200 bg-white p-6">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-900">
              Contagem de escalações no período
            </summary>
            <ul className="mt-4 space-y-2">
              {overview.memberCounts.length === 0 ? (
                <p className="text-sm text-zinc-500">Ninguém foi escalado ainda neste período.</p>
              ) : (
                overview.memberCounts.map((member) => (
                  <li
                    key={member.membershipId}
                    className="rounded-lg border border-zinc-100 px-4 py-2 text-sm"
                  >
                    <span className="font-medium text-zinc-900">{member.memberName}</span>
                    <span className="text-zinc-600">
                      : {member.total} no total —{' '}
                      {member.byRole.map((role) => `${role.count}x ${role.roleName}`).join(', ')}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </details>
        </>
      ) : (
        <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          Nenhuma escala gerada para este mês ainda.
        </p>
      )}

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">Vagas sem cobertura suficiente</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-700">
              Existem vagas para as quais não há pessoas suficientes disponíveis. Elas ficarão em
              branco na escala gerada. Deseja gerar mesmo assim?
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border px-4 py-2 text-sm"
                onClick={() => setConfirmOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
                onClick={runGenerate}
              >
                Gerar mesmo assim
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
