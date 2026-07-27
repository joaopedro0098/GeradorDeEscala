'use client';

import { useTransition } from 'react';
import { X } from 'lucide-react';
import { markNotificationReadAction } from '@/modules/auth/actions';

export function DismissNotificationButton({ notificationId }: { notificationId: string }) {
  const [isPending, startTransition] = useTransition();

  function dismiss() {
    startTransition(async () => {
      await markNotificationReadAction(notificationId);
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={dismiss}
      className="cursor-pointer rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-60"
      aria-label="Remover notificação"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
