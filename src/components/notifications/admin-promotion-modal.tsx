'use client';

import { markNotificationReadAction } from '@/modules/auth/actions';

export function AdminPromotionModal({ notificationId }: { notificationId: string }) {
  const dismiss = markNotificationReadAction.bind(null, notificationId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-zinc-900">Você foi promovido a Admin</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-700">
          Vá para login, marque a opção Admin e entre com seu login e senha atuais. Não crie outra
          conta nem peça as credenciais de outro Admin. Sua área de usuário permanece intacta.
        </p>
        <form action={dismiss} className="mt-6">
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            Entendi
          </button>
        </form>
      </div>
    </div>
  );
}
