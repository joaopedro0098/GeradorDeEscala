'use client';

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { leaveOrganizationAction } from '@/modules/auth/actions';

export function SelfLeaveOrganizationButton({ membershipId }: { membershipId: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  function confirmLeave() {
    startTransition(async () => {
      await leaveOrganizationAction(membershipId);
    });
  }

  const modal =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-red-800">Zona de perigo</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-700">
                Ao realizar esta ação você não poderá reverter, deseja prosseguir?
              </p>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  className="flex-1 cursor-pointer rounded-lg border px-4 py-2 text-sm"
                  onClick={() => setOpen(false)}
                >
                  Não
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  className="flex-1 cursor-pointer rounded-lg bg-red-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  onClick={confirmLeave}
                >
                  {isPending ? 'Saindo...' : 'Sim'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700"
      >
        Desassociar
      </button>
      {modal}
    </>
  );
}
