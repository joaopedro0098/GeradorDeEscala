'use client';

import {
  acceptAdminPromotionAction,
  markNotificationReadAction,
} from '@/modules/auth/actions';

export function AdminPromotionModal({ notificationId }: { notificationId: string }) {
  const dismiss = markNotificationReadAction.bind(null, notificationId);
  const goAdmin = acceptAdminPromotionAction.bind(null, notificationId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-zinc-900">Você foi promovido a Admin</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-700">
          Não precisa sair e entrar de novo. Use o botão{' '}
          <span className="font-medium text-zinc-900">Ver como Admin</span> no cabeçalho para abrir
          a área administrativa desta organização. Sua área de membro continua disponível a qualquer
          momento.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <form action={goAdmin}>
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            >
              Ir para Admin agora
            </button>
          </form>
          <form action={dismiss}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800"
            >
              Mais tarde
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
