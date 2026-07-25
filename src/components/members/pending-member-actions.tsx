'use client';

import { useTransition } from 'react';
import { approveMemberAction, rejectMemberAction } from '@/modules/auth/actions';
import { showSuccessToast } from '@/components/ui/success-toast';

export function PendingMemberActions({ membershipId }: { membershipId: string }) {
  const [isPending, startTransition] = useTransition();

  function approve() {
    startTransition(async () => {
      await approveMemberAction(membershipId);
      showSuccessToast();
    });
  }

  function reject() {
    startTransition(async () => {
      await rejectMemberAction(membershipId);
      showSuccessToast();
    });
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={approve}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-60"
      >
        Aceitar
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={reject}
        className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-60"
      >
        Recusar
      </button>
    </div>
  );
}
