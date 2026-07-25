'use client';

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  saveDayRoleQuantityAction,
  setPriorityRoleOrderAction,
} from '@/modules/scheduling/actions';
import { showSuccessToast } from '@/components/ui/success-toast';
import type { DayRequirementSummary, PriorityRoleSummary } from '@/modules/scheduling/types';
import type { DayOfWeek } from '@/generated/prisma/client';

type DragState = {
  roleId: string;
  fromIndex: number;
  insertAt: number;
  grabOffsetX: number;
  grabOffsetY: number;
  width: number;
  height: number;
  x: number;
  y: number;
};

type VisualRow =
  | { kind: 'item'; item: PriorityRoleSummary; sourceIndex: number }
  | { kind: 'blank' };

function reorderByGap<T>(list: T[], from: number, gap: number): T[] {
  if (gap === from || gap === from + 1) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(gap > from ? gap - 1 : gap, 0, item);
  return next;
}

function isNoOpMove(from: number, gap: number): boolean {
  return gap === from || gap === from + 1;
}

function blankGapInWithout(fromIndex: number, insertAt: number): number {
  return insertAt > fromIndex ? insertAt - 1 : insertAt;
}

function toFullListGap(fromIndex: number, gapInWithout: number): number {
  return gapInWithout >= fromIndex ? gapInWithout + 1 : gapInWithout;
}

function buildVisualRows(items: PriorityRoleSummary[], drag: DragState | null): VisualRow[] {
  if (!drag) {
    return items.map((item, sourceIndex) => ({ kind: 'item', item, sourceIndex }));
  }

  const without = items
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .filter((entry) => entry.sourceIndex !== drag.fromIndex);

  const gap = blankGapInWithout(drag.fromIndex, drag.insertAt);
  const rows: VisualRow[] = [];

  for (let index = 0; index <= without.length; index += 1) {
    if (index === gap) rows.push({ kind: 'blank' });
    if (index < without.length) {
      rows.push({
        kind: 'item',
        item: without[index].item,
        sourceIndex: without[index].sourceIndex,
      });
    }
  }

  return rows;
}

export function DayFormationPriorityList({
  dayOfWeek,
  priorityRoles,
  dayRequirements,
}: {
  dayOfWeek: DayOfWeek;
  priorityRoles: PriorityRoleSummary[];
  dayRequirements: DayRequirementSummary[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(priorityRoles);
  const [quantities, setQuantities] = useState(() =>
    Object.fromEntries(dayRequirements.map((item) => [item.roleId, item.quantity])),
  );
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [draftQuantity, setDraftQuantity] = useState('0');
  const [drag, setDrag] = useState<DragState | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const itemRowRefs = useRef<Map<number, HTMLElement>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  const itemsRef = useRef(items);

  useEffect(() => {
    setItems(priorityRoles);
  }, [priorityRoles]);

  useEffect(() => {
    setQuantities(
      Object.fromEntries(dayRequirements.map((item) => [item.roleId, item.quantity])),
    );
  }, [dayRequirements]);

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  function resolveInsertAt(clientY: number): number {
    const current = dragRef.current;
    if (!current) return 0;

    const without = itemsRef.current.filter((_, index) => index !== current.fromIndex);

    for (let index = 0; index < without.length; index += 1) {
      const sourceIndex = itemsRef.current.findIndex(
        (item, itemIndex) =>
          itemIndex !== current.fromIndex && item.roleId === without[index].roleId,
      );
      const el = itemRowRefs.current.get(sourceIndex);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        return toFullListGap(current.fromIndex, index);
      }
    }

    return itemsRef.current.length;
  }

  function finishDrag() {
    const current = dragRef.current;
    if (!current) return;

    const { fromIndex, insertAt } = current;
    setDrag(null);
    dragRef.current = null;

    if (isNoOpMove(fromIndex, insertAt)) return;

    const next = reorderByGap(itemsRef.current, fromIndex, insertAt);
    setItems(next);
    setError(null);
    startTransition(async () => {
      const result = await setPriorityRoleOrderAction(next.map((item) => item.roleId));
      if (result.error) {
        setItems(priorityRoles);
        setError(result.error);
        return;
      }
      showSuccessToast();
      router.refresh();
    });
  }

  useEffect(() => {
    if (!drag) return;

    function onPointerMove(event: PointerEvent) {
      const current = dragRef.current;
      if (!current) return;

      const nextDrag: DragState = {
        ...current,
        x: event.clientX - current.grabOffsetX,
        y: event.clientY - current.grabOffsetY,
        insertAt: resolveInsertAt(event.clientY),
      };
      dragRef.current = nextDrag;
      setDrag(nextDrag);
    }

    function onPointerUp() {
      finishDrag();
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [drag, priorityRoles]);

  function onCardPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    roleId: string,
    index: number,
  ) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-no-drag]')) return;
    if (editingRoleId) return;
    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const nextDrag: DragState = {
      roleId,
      fromIndex: index,
      insertAt: index,
      grabOffsetX: event.clientX - rect.left,
      grabOffsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      x: rect.left,
      y: rect.top,
    };
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function startEdit(roleId: string) {
    setEditingRoleId(roleId);
    setDraftQuantity(String(quantities[roleId] ?? 0));
    setError(null);
  }

  function cancelEdit() {
    setEditingRoleId(null);
    setDraftQuantity('0');
  }

  function saveQuantity(roleId: string) {
    const quantity = Number.parseInt(draftQuantity.replace(/\D/g, ''), 10);
    const nextQuantity = Number.isFinite(quantity) && quantity >= 0 ? quantity : 0;
    setError(null);
    startTransition(async () => {
      const result = await saveDayRoleQuantityAction(dayOfWeek, roleId, nextQuantity);
      if (result.error) {
        setError(result.error);
        return;
      }
      setQuantities((current) => ({ ...current, [roleId]: nextQuantity }));
      setEditingRoleId(null);
      showSuccessToast();
      router.refresh();
    });
  }

  const floatingItem = drag ? items.find((item) => item.roleId === drag.roleId) : null;
  const visualRows = buildVisualRows(items, drag);

  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-600">
        Cadastre funções acima — elas passam a aparecer aqui automaticamente.
      </p>
    );
  }

  return (
    <div className="w-full max-w-[min(100%,28rem)]">
      <ul>
        {visualRows.map((row, visualIndex) => {
          if (row.kind === 'blank' && drag) {
            return (
              <li
                key="blank-slot"
                aria-hidden
                className="flex items-stretch gap-2 pt-2 first:pt-0 transition-all duration-200 ease-out"
              >
                <span className="flex w-7 shrink-0 items-center justify-center text-sm font-semibold tabular-nums text-zinc-400">
                  {visualIndex + 1}
                </span>
                <div
                  className="min-w-0 flex-1 rounded-xl border border-dashed border-zinc-200/80 bg-zinc-50/50"
                  style={{ height: drag.height }}
                />
              </li>
            );
          }

          if (row.kind !== 'item') return null;

          const quantity = quantities[row.item.roleId] ?? 0;
          const isEditing = editingRoleId === row.item.roleId;

          return (
            <li
              key={row.item.roleId}
              ref={(el) => {
                if (el) itemRowRefs.current.set(row.sourceIndex, el);
                else itemRowRefs.current.delete(row.sourceIndex);
              }}
              className="flex items-stretch gap-2 pt-2 first:pt-0 transition-all duration-200 ease-out"
            >
              <span
                aria-hidden
                className="flex w-7 shrink-0 items-center justify-center text-sm font-semibold tabular-nums text-zinc-500"
              >
                {visualIndex + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  data-drag-card
                  onPointerDown={(event) =>
                    onCardPointerDown(event, row.item.roleId, row.sourceIndex)
                  }
                  className={`flex cursor-grab select-none touch-none items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 transition-[border-color,background-color,box-shadow] duration-150 hover:border-zinc-300 hover:bg-zinc-50/80 active:cursor-grabbing ${
                    isPending ? 'opacity-70' : ''
                  }`}
                >
                  <span
                    aria-hidden
                    className="inline-flex h-4 w-3 shrink-0 flex-col justify-center gap-0.5 opacity-35"
                  >
                    <span className="h-0.5 w-full rounded bg-zinc-500" />
                    <span className="h-0.5 w-full rounded bg-zinc-500" />
                    <span className="h-0.5 w-full rounded bg-zinc-500" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800">
                    {row.item.roleName}
                  </span>

                  {isEditing ? (
                    <div data-no-drag className="flex shrink-0 items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={draftQuantity}
                        disabled={isPending}
                        onChange={(event) => {
                          const digits = event.target.value.replace(/\D/g, '');
                          setDraftQuantity(digits === '' ? '' : String(Number(digits)));
                        }}
                        onKeyDown={(event) => {
                          if (['e', 'E', '+', '-', '.', ','].includes(event.key)) {
                            event.preventDefault();
                          }
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            saveQuantity(row.item.roleId);
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelEdit();
                          }
                        }}
                        className="w-14 rounded-lg border border-zinc-300 px-2 py-1 text-sm tabular-nums outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                        aria-label={`Quantidade de ${row.item.roleName}`}
                      />
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => saveQuantity(row.item.roleId)}
                        className="rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
                      >
                        Salvar
                      </button>
                    </div>
                  ) : (
                    <div data-no-drag className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium tabular-nums text-zinc-600">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => startEdit(row.item.roleId)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-60"
                        aria-label={`Editar quantidade de ${row.item.roleName}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {drag && floatingItem ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 flex scale-[1.03] cursor-grabbing items-center gap-2.5 rounded-xl border border-zinc-400 bg-white px-3 py-2.5 shadow-xl shadow-zinc-900/20"
          style={{
            left: drag.x,
            top: drag.y,
            width: drag.width,
            height: drag.height,
          }}
        >
          <span
            aria-hidden
            className="inline-flex h-4 w-3 shrink-0 flex-col justify-center gap-0.5 opacity-35"
          >
            <span className="h-0.5 w-full rounded bg-zinc-500" />
            <span className="h-0.5 w-full rounded bg-zinc-500" />
            <span className="h-0.5 w-full rounded bg-zinc-500" />
          </span>
          <span className="truncate text-sm font-medium text-zinc-800">{floatingItem.roleName}</span>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
