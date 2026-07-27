'use client';

import { useEffect, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MonthHistorySelect } from '@/components/scheduling/month-history-select';
import { showSuccessToast } from '@/components/ui/success-toast';
import {
  type MemberParticipationSummary,
  type ParticipationStatus,
} from '@/modules/availability/availability.logic';
import {
  generateScheduleAction,
  publishScheduleAction,
  setAvailabilityLockedAction,
  setScheduleSlotAssignmentAction,
  setScheduleSlotMinisterAction,
} from '@/modules/scheduling/actions';
import { buildScheduleMatrix } from '@/modules/scheduling/schedule.logic';
import {
  type ScheduleAssignmentCandidate,
  type ScheduleOverview,
  type ScheduleSlotView,
  type ShortageEntryView,
} from '@/modules/scheduling/schedule.types';
import { MemberAvatar } from '@/components/members/member-avatar';
import { truncateByWords } from '@/lib/truncate-by-words';
import { DAY_OF_WEEK_LABELS } from '@/modules/scheduling/types';
import { formatYearMonth, type YearMonth } from '@/modules/scheduling/working-month.logic';

const SCHEDULE_NAME_MAX_LENGTH = 14;

function dayNumber(dateKey: string): number {
  return Number(dateKey.split('-')[2]);
}

type DialogKind = 'shortage' | 'manual' | null;

type ScheduleViewFilter = 'escala' | 'status';

const SCHEDULE_VIEW_FILTERS: Array<{ id: ScheduleViewFilter; label: string }> = [
  { id: 'escala', label: 'Escala' },
  { id: 'status', label: 'Status & Frequência' },
];

const STATUS_FILTERS: Array<{
  id: ParticipationStatus;
  label: string;
  idleClass: string;
  activeClass: string;
}> = [
  {
    id: 'exact',
    label: 'Dentro',
    idleClass: 'border-zinc-300/60 bg-zinc-500/15 text-zinc-700',
    activeClass: 'border-zinc-400 bg-zinc-500/35 text-zinc-900 ring-1 ring-zinc-400/50',
  },
  {
    id: 'below',
    label: 'Abaixo',
    idleClass: 'border-red-300/60 bg-red-500/15 text-red-800',
    activeClass: 'border-red-400 bg-red-500/35 text-red-950 ring-1 ring-red-400/50',
  },
  {
    id: 'above',
    label: 'Acima',
    idleClass:
      'border-[rgba(34,180,60,0.45)] bg-[rgba(34,180,60,0.18)] text-[#15803d]',
    activeClass:
      'border-[rgba(34,180,60,0.7)] bg-[rgba(34,180,60,0.38)] text-[#14532d] ring-1 ring-[rgba(34,180,60,0.45)]',
  },
];

function formatMemberFrequency(member: {
  total: number;
  byRole: Array<{ roleName: string; count: number }>;
}): string {
  if (member.byRole.length === 1) {
    const role = member.byRole[0];
    return `${role.count}X ${role.roleName}`;
  }
  const roles = member.byRole.map((role) => `${role.count}x ${role.roleName}`).join(', ');
  return `${roles} = ${member.total}`;
}

function HelpHint({ text }: { text: string }) {
  return (
    <span className="group/hint absolute top-6 right-6 z-10">
      <span className="flex h-6 w-6 cursor-default items-center justify-center rounded-full border border-zinc-300 text-sm font-normal leading-none text-zinc-400 transition-colors hover:border-zinc-400 hover:text-zinc-500">
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full right-0 z-20 mt-2 hidden w-64 rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-left text-sm font-normal leading-snug text-zinc-600 shadow-md group-hover/hint:block"
      >
        {text}
      </span>
    </span>
  );
}

type SlotPickerState = {
  slotId: string;
  eventId: string;
  roleId: string;
  currentMembershipId: string | null;
  currentMemberName: string | null;
};

type PendingReplaceState = {
  slotId: string;
  fromName: string;
  toMembershipId: string | null;
  toName: string;
};

export function ScheduleAdminView({
  workingMonth,
  viewedMonth,
  isHistory,
  historyMonths,
  overview,
  shortagePreview,
  assignmentCandidates,
  participationSummaries = [],
  availabilityLocked = false,
  readOnly = false,
  isOffline = false,
}: {
  workingMonth: YearMonth;
  viewedMonth: YearMonth;
  isHistory: boolean;
  historyMonths: YearMonth[];
  overview: ScheduleOverview | null;
  shortagePreview: ShortageEntryView[];
  assignmentCandidates: ScheduleAssignmentCandidate[];
  participationSummaries?: MemberParticipationSummary[];
  /** When true, availability table is locked for members. */
  availabilityLocked?: boolean;
  readOnly?: boolean;
  isOffline?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [tableLocked, setTableLocked] = useState(availabilityLocked);
  const [viewFilter, setViewFilter] = useState<ScheduleViewFilter>('escala');
  const [statusFilter, setStatusFilter] = useState<ParticipationStatus>('exact');
  const [slotPicker, setSlotPicker] = useState<SlotPickerState | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pendingReplace, setPendingReplace] = useState<PendingReplaceState | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const pickerInputRef = useRef<HTMLInputElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    setTableLocked(availabilityLocked);
  }, [availabilityLocked]);

  useEffect(() => {
    if (!slotPicker) return;
    const timer = window.setTimeout(() => pickerInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [slotPicker]);

  const matrix = buildScheduleMatrix(overview?.events ?? []);
  const minimumDays = participationSummaries[0]?.minimumDays ?? 0;
  const filteredParticipation = participationSummaries.filter(
    (summary) => summary.status === statusFilter,
  );

  function eligibleForSlot(eventId: string, roleId: string): ScheduleAssignmentCandidate[] {
    return assignmentCandidates.filter(
      (candidate) =>
        candidate.roleIds.includes(roleId) && candidate.availableEventIds.includes(eventId),
    );
  }

  function openSlotPicker(slot: ScheduleSlotView, eventId: string) {
    if (readOnly || isPending) return;
    setPickerQuery('');
    setSlotPicker({
      slotId: slot.id,
      eventId,
      roleId: slot.roleId,
      currentMembershipId: slot.membershipId,
      currentMemberName: slot.memberName,
    });
  }

  function closeSlotPicker() {
    setSlotPicker(null);
    setPickerQuery('');
  }

  function proposeReplacement(candidate: {
    membershipId: string | null;
    memberName: string;
  }) {
    if (!slotPicker) return;
    if (candidate.membershipId === slotPicker.currentMembershipId) {
      closeSlotPicker();
      return;
    }
    setPendingReplace({
      slotId: slotPicker.slotId,
      fromName: slotPicker.currentMemberName?.trim() || 'vazio',
      toMembershipId: candidate.membershipId,
      toName: candidate.memberName,
    });
    closeSlotPicker();
  }

  function confirmReplacement() {
    if (!pendingReplace) return;
    const { slotId, toMembershipId } = pendingReplace;
    setPendingReplace(null);
    handleAssignmentChange(slotId, toMembershipId);
  }

  function cancelReplacement() {
    setPendingReplace(null);
  }

  function handleTablePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const container = tableScrollRef.current;
    if (!container) return;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
      moved: false,
    };
    setIsPanning(true);
    container.setPointerCapture(event.pointerId);
  }

  function handleTablePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    const container = tableScrollRef.current;
    if (!pan || pan.pointerId !== event.pointerId || !container) return;
    const dx = event.clientX - pan.startX;
    const dy = event.clientY - pan.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      pan.moved = true;
    }
    container.scrollLeft = pan.scrollLeft - dx;
    container.scrollTop = pan.scrollTop - dy;
  }

  function endTablePan(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    const container = tableScrollRef.current;
    if (container?.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
    // Keep `moved` until the following click so name/star clicks can ignore drag releases.
    window.setTimeout(() => {
      if (panRef.current === pan) panRef.current = null;
    }, 0);
    setIsPanning(false);
  }

  function wasTableDragged(): boolean {
    return Boolean(panRef.current?.moved);
  }

  const pickerCandidates = slotPicker
    ? eligibleForSlot(slotPicker.eventId, slotPicker.roleId).filter((candidate) =>
        candidate.memberName.toLowerCase().includes(pickerQuery.trim().toLowerCase()),
      )
    : [];

  function runGenerate(keepManual: boolean) {
    setDialog(null);
    setError(null);
    startTransition(async () => {
      const result = await generateScheduleAction(keepManual);
      if (result.error) {
        setError(result.error);
        return;
      }
      showSuccessToast();
      router.refresh();
    });
  }

  function proceedAfterShortageConfirm() {
    if (overview?.hasManualSlots) {
      setDialog('manual');
      return;
    }
    runGenerate(false);
  }

  function handleGenerateClick() {
    if (readOnly) return;
    setError(null);
    if (shortagePreview.length > 0) {
      setDialog('shortage');
      return;
    }
    if (overview?.hasManualSlots) {
      setDialog('manual');
      return;
    }
    runGenerate(false);
  }

  function handlePublish() {
    setError(null);
    startTransition(async () => {
      const result = await publishScheduleAction();
      if (result.error) {
        setError(result.error);
        return;
      }
      showSuccessToast();
      router.refresh();
    });
  }

  function handleAssignmentChange(slotId: string, membershipId: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await setScheduleSlotAssignmentAction(slotId, membershipId);
      if (result.error) {
        setError(result.error);
        return;
      }
      showSuccessToast();
      router.refresh();
    });
  }

  function handleToggleMinister(slotId: string) {
    setError(null);
    startTransition(async () => {
      const result = await setScheduleSlotMinisterAction(slotId);
      if (result.error) {
        setError(result.error);
        return;
      }
      showSuccessToast();
      router.refresh();
    });
  }

  function handleToggleTableLock(nextLocked: boolean) {
    if (readOnly || isHistory) return;
    setError(null);
    setTableLocked(nextLocked);
    startTransition(async () => {
      const result = await setAvailabilityLockedAction(nextLocked);
      if (result.error) {
        setTableLocked(!nextLocked);
        setError(result.error);
        return;
      }
      showSuccessToast();
      router.refresh();
    });
  }

  function renderScheduleToolbar() {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {!isHistory ? (
            <>
              <button
                type="button"
                disabled={isPending || readOnly}
                onClick={handleGenerateClick}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 transition-colors hover:border-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-bg)] hover:text-white disabled:opacity-60"
              >
                Gerar
              </button>
              {overview?.status === 'DRAFT' ? (
                <button
                  type="button"
                  disabled={isPending || readOnly}
                  onClick={handlePublish}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 transition-colors hover:border-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-bg)] hover:text-white disabled:opacity-60"
                >
                  Publicar
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthHistorySelect
            basePath="/admin/escala"
            workingMonth={workingMonth}
            viewedMonth={viewedMonth}
            isHistory={isHistory}
            historyMonths={historyMonths}
            disabled={isOffline}
          />
          {!isHistory ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600">
                {tableLocked ? 'Tabela trancada' : 'Trancar tabela'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={tableLocked}
                disabled={isPending || readOnly}
                title={
                  tableLocked
                    ? 'Destrancar: membros poderão editar disponibilidade'
                    : 'Trancar: membros só poderão visualizar'
                }
                onClick={() => handleToggleTableLock(!tableLocked)}
                className={`relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                  tableLocked ? 'bg-[var(--btn-primary-bg)]' : 'bg-zinc-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    tableLocked ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
                <span className="sr-only">
                  {tableLocked ? 'Tabela trancada' : 'Tabela destrancada'}
                </span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Escala de <span className="capitalize">{formatYearMonth(viewedMonth)}</span>
        </h2>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      </section>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SCHEDULE_VIEW_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setViewFilter(filter.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm ${
              viewFilter === filter.id
                ? 'btn-solid'
                : 'border border-zinc-300 text-zinc-700'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {viewFilter === 'status' ? (
        <div className="flex flex-nowrap gap-4">
          <section className="relative min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-white p-6">
            <HelpHint text="Aqui é contabilizado o número total que o membro marcou na planilha de disponibilidade" />
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Status de participação</h3>
              <p className="mt-1 text-sm text-zinc-600">
                Mínimo {minimumDays} {minimumDays === 1 ? 'dia' : 'dias'}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {STATUS_FILTERS.map((filter) => {
                const isActive = statusFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setStatusFilter(filter.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      isActive ? filter.activeClass : filter.idleClass
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            {filteredParticipation.length > 0 ? (
              <ul className="mt-4 divide-y divide-zinc-100">
                {filteredParticipation.map((summary) => (
                  <li
                    key={summary.membershipId}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <MemberAvatar
                        name={summary.memberName}
                        photoUrl={summary.profilePhotoUrl}
                      />
                      <span className="truncate font-medium text-zinc-900">{summary.memberName}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-zinc-600">
                      {summary.markedDays}{' '}
                      {summary.markedDays === 0 || summary.markedDays === 1 ? 'dia' : 'dias'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-zinc-600">
                Nenhuma pessoa neste filtro no período.
              </p>
            )}
          </section>

          <section className="relative min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-white p-6">
            <HelpHint text="Aqui é contabilizado a quantidade real de vezes que o membro foi escalado(a)" />
            <h3 className="text-sm font-semibold text-zinc-900">Frequência na escala</h3>
            {!overview ? (
              <p className="mt-3 text-sm text-zinc-600">
                Gere a escala para ver a frequência de escalações.
              </p>
            ) : overview.memberCounts.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">Ninguém foi escalado ainda neste período.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {overview.memberCounts.map((member) => (
                  <li
                    key={member.membershipId}
                    className="rounded-lg border border-zinc-100 px-4 py-2 text-sm"
                  >
                    <div className="flex items-start gap-2">
                      <MemberAvatar
                        name={member.memberName}
                        photoUrl={member.profilePhotoUrl}
                      />
                      <div className="min-w-0">
                        <span className="font-medium text-zinc-900">{member.memberName}</span>
                        <span className="mt-0.5 block text-zinc-600">
                          {formatMemberFrequency(member)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {viewFilter === 'escala' ? (
        <section>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            {renderScheduleToolbar()}
            {!overview ? (
              <p className="p-6 text-sm text-zinc-600">
                Nenhuma escala gerada para este mês ainda.
              </p>
            ) : matrix.columns.length === 0 || matrix.rows.length === 0 ? (
              <p className="p-6 text-sm text-zinc-600">
                Nenhuma vaga configurada para os dias de evento deste período.
              </p>
            ) : (
              <div
                ref={tableScrollRef}
                onPointerDown={handleTablePointerDown}
                onPointerMove={handleTablePointerMove}
                onPointerUp={endTablePan}
                onPointerCancel={endTablePan}
                className={`max-h-[calc(100vh-8rem)] overflow-auto bg-white ${
                  isPanning ? 'cursor-grabbing select-none' : 'cursor-default'
                }`}
              >
                <table
                  className="w-full table-fixed border-collapse border border-zinc-400 text-sm leading-tight"
                  style={{
                    minWidth: `calc(6rem + ${matrix.columns.length} * 7rem)`,
                  }}
                >
                  <colgroup>
                    <col style={{ width: '6rem' }} />
                    {matrix.columns.map((column) => (
                      <col key={column.roleId} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="bg-zinc-100">
                      <th className="sticky left-0 z-10 border border-zinc-400 bg-zinc-100 px-1 py-1 text-center text-xs font-semibold text-zinc-700 shadow-[1px_0_0_0_#a1a1aa]">
                        Dia
                      </th>
                      {matrix.columns.map((column) => (
                        <th
                          key={column.roleId}
                          className="border border-zinc-400 px-1.5 py-1 text-center text-xs font-semibold uppercase tracking-wide break-words text-zinc-900"
                        >
                          {column.roleName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.rows.map((row) => (
                      <tr key={row.eventId} className="align-middle">
                        <th className="sticky left-0 z-10 border border-zinc-400 bg-white px-1 py-0.5 text-center font-normal shadow-[1px_0_0_0_#a1a1aa]">
                          <span className="block text-sm font-semibold leading-tight text-zinc-900">
                            Dia {dayNumber(row.date)}
                          </span>
                          <span className="block whitespace-normal text-xs leading-tight text-zinc-600">
                            {DAY_OF_WEEK_LABELS[row.dayOfWeek]}
                          </span>
                        </th>
                        {row.cells.map((cell) => (
                          <td
                            key={`${row.eventId}-${cell.roleId}`}
                            className="min-h-10 border border-zinc-400 px-1 py-0.5 text-center align-middle"
                          >
                            {cell.slots.length === 0 ? (
                              <span className="inline-flex h-5 items-center justify-center text-zinc-400">
                                —
                              </span>
                            ) : (
                              <div className="flex min-h-5 flex-col justify-center space-y-0.5">
                                {cell.slots.map((slot) => {
                                  const isEmpty = !slot.membershipId;
                                  const fullLabel = slot.memberName?.trim() || 'vazio';
                                  const label = isEmpty
                                    ? fullLabel
                                    : truncateByWords(fullLabel, SCHEDULE_NAME_MAX_LENGTH);
                                  return (
                                    <div
                                      key={slot.id}
                                      className="relative flex min-h-5 items-center justify-center overflow-hidden px-0.5 py-0 pr-3"
                                    >
                                      {readOnly ? (
                                        <span
                                          title={fullLabel}
                                          className={`block w-full overflow-hidden text-ellipsis whitespace-nowrap leading-5 ${
                                            isEmpty ? 'italic text-zinc-400' : 'text-zinc-900'
                                          }`}
                                        >
                                          {label}
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={isPending}
                                          title={fullLabel}
                                          onClick={() => {
                                            if (wasTableDragged()) return;
                                            openSlotPicker(slot, row.eventId);
                                          }}
                                          className={`block w-full overflow-hidden text-ellipsis whitespace-nowrap rounded px-0.5 py-0 text-center leading-5 hover:bg-zinc-100 disabled:opacity-60 ${
                                            isEmpty ? 'italic text-zinc-400' : 'text-zinc-900'
                                          }`}
                                        >
                                          {label}
                                        </button>
                                      )}
                                      {!readOnly && slot.membershipId ? (
                                        <button
                                          type="button"
                                          disabled={isPending}
                                          title={
                                            slot.isMinister
                                              ? 'Remover ministro'
                                              : 'Marcar ministro'
                                          }
                                          onClick={() => {
                                            if (wasTableDragged()) return;
                                            handleToggleMinister(slot.id);
                                          }}
                                          className={`absolute top-0 right-0 leading-none disabled:opacity-60 ${
                                            slot.isMinister
                                              ? 'text-[10px] text-amber-700'
                                              : 'text-[10px] text-zinc-300 hover:text-zinc-500'
                                          }`}
                                        >
                                          ★
                                        </button>
                                      ) : null}
                                      {readOnly && slot.isMinister ? (
                                        <span className="absolute top-0 right-0 text-[10px] leading-none text-amber-700">
                                          ★
                                        </span>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {slotPicker ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">Procurar pessoa</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Digite o nome para filtrar quem pode ocupar esta vaga.
            </p>
            <input
              ref={pickerInputRef}
              type="search"
              value={pickerQuery}
              onChange={(event) => setPickerQuery(event.target.value)}
              placeholder="Buscar pelo nome"
              className="mt-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
            />
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
              {slotPicker.currentMembershipId ? (
                <li>
                  <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-left text-sm italic text-zinc-500 hover:bg-zinc-100"
                    onClick={() =>
                      proposeReplacement({ membershipId: null, memberName: 'vazio' })
                    }
                  >
                    vazio
                  </button>
                </li>
              ) : null}
              {pickerCandidates.length === 0 ? (
                <li className="px-3 py-2 text-sm text-zinc-500">Nenhuma pessoa encontrada.</li>
              ) : (
                pickerCandidates.map((candidate) => (
                  <li key={candidate.membershipId}>
                    <button
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-900 hover:bg-zinc-100"
                      onClick={() =>
                        proposeReplacement({
                          membershipId: candidate.membershipId,
                          memberName: candidate.memberName,
                        })
                      }
                    >
                      {candidate.memberName}
                    </button>
                  </li>
                ))
              )}
            </ul>
            <div className="mt-4">
              <button
                type="button"
                className="w-full rounded-lg border px-4 py-2 text-sm"
                onClick={closeSlotPicker}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingReplace ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">Confirmar substituição</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-700">
              Você irá substituir {pendingReplace.fromName} por {pendingReplace.toName}. Deseja
              prosseguir?
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border px-4 py-2 text-sm"
                onClick={cancelReplacement}
              >
                Não
              </button>
              <button
                type="button"
                className="btn-solid flex-1 rounded-lg px-4 py-2 text-sm font-medium"
                onClick={confirmReplacement}
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dialog === 'shortage' ? (
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
                onClick={() => setDialog(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-solid flex-1 rounded-lg px-4 py-2 text-sm font-medium"
                onClick={proceedAfterShortageConfirm}
              >
                Gerar mesmo assim
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dialog === 'manual' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">Alterações manuais detectadas</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-700">
              Você realizou alterações manuais nesta escala. Deseja manter as alterações manuais ou
              regenerar 100%?
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="flex-1 rounded-lg border px-4 py-2 text-sm"
                onClick={() => setDialog(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg border border-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--btn-primary-bg)]"
                onClick={() => runGenerate(true)}
              >
                Manter manuais
              </button>
              <button
                type="button"
                className="btn-solid flex-1 rounded-lg px-4 py-2 text-sm font-medium"
                onClick={() => runGenerate(false)}
              >
                Regenerar 100%
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
