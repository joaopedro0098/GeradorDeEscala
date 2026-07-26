'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createOrganizationAction, type ActionState } from '@/modules/auth/actions';
import { Alert, Field } from '@/components/auth/auth-ui';
import { useToastActionState } from '@/components/ui/success-toast';

export function CreateOrganizationForm({ isFirstOrganization }: { isFirstOrganization: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [state, formAction] = useToastActionState<ActionState>(createOrganizationAction, {});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (state.success) {
      setOpen(false);
    }
  }, [state.success]);

  const modal =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-zinc-900">Criar organização</h3>
              <p className="mt-2 text-sm text-zinc-600">
                {isFirstOrganization
                  ? 'Ao criar, você vira admin principal e começa um período de teste de 14 dias.'
                  : 'A nova organização entra na lista. Você continua na organização atual até trocar manualmente.'}
              </p>
              <form action={formAction} className="mt-4 space-y-3">
                <Field label="Nome da organização" name="organizationName" />
                {state.error ? <Alert message={state.error} tone="error" /> : null}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                    onClick={() => setOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-solid flex-1 rounded-lg px-4 py-2 text-sm font-medium"
                  >
                    Salvar
                  </button>
                </div>
              </form>
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
        className="btn-solid rounded-lg px-4 py-2.5 text-sm font-medium"
      >
        Criar organização
      </button>
      {modal}
    </>
  );
}
