'use client';

import { useState, useTransition } from 'react';
import { removeMemberAction } from '@/modules/auth/actions';
import { showSuccessToast } from '@/components/ui/success-toast';

export function RemoveMemberButton({
  membershipId,
  memberName,
  compact = false,
}: {
  membershipId: string;
  memberName: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirmRemove() {
    startTransition(async () => {
      await removeMemberAction(membershipId);
      showSuccessToast();
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? 'rounded-lg border border-red-300 px-2.5 py-1 text-xs text-red-700'
            : 'rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700'
        }
      >
        Desassociar
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">Desassociar membro</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-700">
              Essa ação é irreversível, deseja prosseguir?
              {memberName ? (
                <>
                  {' '}
                  O membro <span className="font-medium text-zinc-900">{memberName}</span> será
                  desassociado desta organização e perderá seus dados e sua sincronização com ela.
                  A conta continuará existindo, mas, para entrar novamente, será necessário enviar
                  uma nova solicitação pelo código da organização.
                </>
              ) : null}
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={isPending}
                className="flex-1 rounded-lg border px-4 py-2 text-sm"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPending}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                onClick={confirmRemove}
              >
                {isPending ? 'Desassociando...' : 'Desassociar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
