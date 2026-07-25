'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { setMemberRolePreferencesAction } from '@/modules/auth/actions';
import { showSuccessToast } from '@/components/ui/success-toast';

export type OrgRoleOption = { id: string; name: string };
export type MemberRolePreferenceItem = { id: string; name: string; sortOrder: number };

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
  | { kind: 'item'; item: MemberRolePreferenceItem; sourceIndex: number }
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

function buildVisualRows(
  items: MemberRolePreferenceItem[],
  drag: DragState | null,
): VisualRow[] {
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

export function MemberRolePreferencesEditor({
  membershipId,
  availableRoles,
  initialPreferences,
}: {
  membershipId: string;
  availableRoles: OrgRoleOption[];
  initialPreferences: MemberRolePreferenceItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialPreferences);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const itemRowRefs = useRef<Map<number, HTMLElement>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  const itemsRef = useRef(items);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems(initialPreferences);
  }, [initialPreferences]);

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!searchRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const selectedIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return availableRoles
      .filter((role) => !selectedIds.has(role.id))
      .filter(
        (role) => !normalized || role.name.toLocaleLowerCase('pt-BR').includes(normalized),
      )
      .slice(0, 8);
  }, [availableRoles, selectedIds, query]);

  function persist(next: MemberRolePreferenceItem[]) {
    setError(null);
    startTransition(async () => {
      const result = await setMemberRolePreferencesAction(
        membershipId,
        next.map((item) => item.id),
      );
      if (result.error) {
        setItems(initialPreferences);
        setError(result.error);
        return;
      }
      showSuccessToast();
      router.refresh();
    });
  }

  function addRole(role: OrgRoleOption) {
    if (selectedIds.has(role.id)) return;
    const next = [
      ...items,
      { id: role.id, name: role.name, sortOrder: items.length + 1 },
    ];
    setItems(next);
    setQuery('');
    setSearchOpen(false);
    persist(next);
  }

  function removeRole(roleId: string) {
    const next = items.filter((item) => item.id !== roleId);
    setItems(next);
    persist(next);
  }

  function resolveInsertAt(clientY: number): number {
    const current = dragRef.current;
    if (!current) return 0;

    const without = itemsRef.current.filter((_, index) => index !== current.fromIndex);

    for (let index = 0; index < without.length; index += 1) {
      const sourceIndex = itemsRef.current.findIndex(
        (item, itemIndex) =>
          itemIndex !== current.fromIndex && item.id === without[index].id,
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

    const next = reorderByGap(itemsRef.current, fromIndex, insertAt).map((item, index) => ({
      ...item,
      sortOrder: index + 1,
    }));
    setItems(next);
    persist(next);
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
  }, [drag, initialPreferences]);

  function onCardPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    roleId: string,
    index: number,
  ) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-remove-role]')) return;
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

  const floatingItem = drag ? items.find((item) => item.id === drag.roleId) : null;
  const visualRows = buildVisualRows(items, drag);

  return (
    <div className="space-y-3">
      <div ref={searchRef} className="relative">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="busque uma função"
            disabled={isPending || availableRoles.length === 0}
            className="w-full rounded-xl border border-zinc-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 disabled:opacity-60"
          />
        </label>
        {searchOpen && availableRoles.length > 0 ? (
          <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
            {searchResults.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-zinc-500">Nenhuma função encontrada.</li>
            ) : (
              searchResults.map((role) => (
                <li key={role.id}>
                  <button
                    type="button"
                    onClick={() => addRole(role)}
                    className="w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
                  >
                    {role.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      {availableRoles.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Cadastre funções em Configurações › Funções & Formação para atribuí-las aqui.
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="w-full max-w-[min(100%,18rem)]">
          <ul>
            {visualRows.map((row, visualIndex) => {
              if (row.kind === 'blank' && drag) {
                return (
                  <li
                    key="blank-slot"
                    aria-hidden
                    className="flex items-stretch gap-2 pt-1.5 first:pt-0 transition-all duration-200 ease-out"
                  >
                    <span className="flex w-6 shrink-0 items-center justify-center text-sm font-semibold tabular-nums text-zinc-400">
                      {visualIndex + 1}
                    </span>
                    <div
                      className="min-w-0 flex-1 rounded-lg border border-dashed border-zinc-200/80 bg-zinc-50/50"
                      style={{ height: drag.height }}
                    />
                  </li>
                );
              }

              if (row.kind !== 'item') return null;

              return (
                <li
                  key={row.item.id}
                  ref={(el) => {
                    if (el) itemRowRefs.current.set(row.sourceIndex, el);
                    else itemRowRefs.current.delete(row.sourceIndex);
                  }}
                  className="flex items-stretch gap-2 pt-1.5 first:pt-0 transition-all duration-200 ease-out"
                >
                  <span
                    aria-hidden
                    className="flex w-6 shrink-0 items-center justify-center text-sm font-semibold tabular-nums text-zinc-500"
                  >
                    {visualIndex + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      data-drag-card
                      onPointerDown={(event) =>
                        onCardPointerDown(event, row.item.id, row.sourceIndex)
                      }
                      className={`flex cursor-grab select-none touch-none items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 transition-[border-color,background-color,box-shadow] duration-150 hover:border-zinc-300 hover:bg-zinc-50/80 active:cursor-grabbing ${
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
                        {row.item.name}
                      </span>
                      <button
                        type="button"
                        data-remove-role
                        disabled={isPending}
                        onClick={() => removeRole(row.item.id)}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-60"
                        aria-label={`Remover ${row.item.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {drag && floatingItem ? (
            <div
              aria-hidden
              className="pointer-events-none fixed z-50 flex scale-[1.03] cursor-grabbing items-center gap-2 rounded-lg border border-zinc-400 bg-white px-2.5 py-1.5 shadow-xl shadow-zinc-900/20"
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
              <span className="truncate text-sm font-medium text-zinc-800">{floatingItem.name}</span>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Nenhuma função atribuída ainda.</p>
      )}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
