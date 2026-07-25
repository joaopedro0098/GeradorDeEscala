'use client';

import { useEffect, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from 'react';
import { setPriorityRoleOrderAction } from '@/modules/scheduling/actions';
import type { PriorityRoleSummary } from '@/modules/scheduling/types';

type DragState = {
  roleId: string;
  fromIndex: number;
  /** Gap in the full list (including the dragged item): 0..length */
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

export function PriorityRolesList({ priorityRoles }: { priorityRoles: PriorityRoleSummary[] }) {
  const [items, setItems] = useState(priorityRoles);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [isPending, startTransition] = useTransition();
  const itemRowRefs = useRef<Map<number, HTMLElement>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  const itemsRef = useRef(items);

  useEffect(() => {
    setItems(priorityRoles);
  }, [priorityRoles]);

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
    startTransition(async () => {
      const result = await setPriorityRoleOrderAction(next.map((item) => item.roleId));
      if (result.error) {
        setItems(priorityRoles);
      }
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

  const floatingItem = drag ? items.find((item) => item.roleId === drag.roleId) : null;
  const visualRows = buildVisualRows(items, drag);

  if (items.length === 0) {
    return (
      <p className="mt-4 text-sm text-zinc-600">
        Cadastre funções em Funções & Formação — elas passam a aparecer aqui automaticamente.
      </p>
    );
  }

  return (
    <div className="mt-4 w-full max-w-[min(100%,22rem)] sm:max-w-[50%]">
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
                  <span className="truncate text-sm font-medium text-zinc-800">
                    {row.item.roleName}
                  </span>
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
    </div>
  );
}
