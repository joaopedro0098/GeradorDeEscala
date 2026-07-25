'use client';

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const TOAST_DURATION_MS = 2000;
const DEFAULT_MESSAGE = 'Salvo com sucesso';

type ToastHandler = (message: string) => void;

declare global {
  interface Window {
    __equipgestorShowSuccessToast?: ToastHandler;
  }
}

export function showSuccessToast(message: string = DEFAULT_MESSAGE) {
  if (typeof window === 'undefined') return;
  const text = message.trim() || DEFAULT_MESSAGE;
  // Prefer the live host callback so HMR / duplicated modules still work.
  if (window.__equipgestorShowSuccessToast) {
    window.__equipgestorShowSuccessToast(text);
    return;
  }
  window.dispatchEvent(
    new CustomEvent('equipgestor:success-toast', {
      detail: { message: text },
    }),
  );
}

/**
 * useActionState wrapper that shows the top toast whenever the action returns success.
 * Runs on the client after the server action resolves — more reliable than watching isPending.
 */
export function useToastActionState<State extends { success?: string; error?: string }>(
  action: (prev: State, formData: FormData) => Promise<State> | State,
  initialState: State,
) {
  return useActionState(
    async (prev: State, formData: FormData) => {
      const result = await action(prev, formData);
      if (result.success && !result.error) {
        showSuccessToast();
      }
      return result;
    },
    initialState as never,
  ) as [State, (payload: FormData) => void, boolean];
}

/** @deprecated Prefer useToastActionState — kept for call sites that already have state. */
export function useSaveSuccessToast(success: string | undefined, isPending: boolean) {
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && success) {
      showSuccessToast();
    }
    wasPending.current = isPending;
  }, [isPending, success]);
}

export function SuccessToastHost() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const hideTimerRef = useRef<number | null>(null);
  const removeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);

    function clearTimers() {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      if (removeTimerRef.current) window.clearTimeout(removeTimerRef.current);
      hideTimerRef.current = null;
      removeTimerRef.current = null;
    }

    function present(nextMessage: string) {
      clearTimers();
      setMessage(nextMessage);
      setOpen(true);
      setVisible(false);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setVisible(true);
        });
      });

      hideTimerRef.current = window.setTimeout(() => {
        setVisible(false);
        removeTimerRef.current = window.setTimeout(() => {
          setOpen(false);
        }, 280);
      }, TOAST_DURATION_MS);
    }

    const onToast = (event: Event) => {
      const custom = event as CustomEvent<{ message?: string }>;
      present(custom.detail?.message?.trim() || DEFAULT_MESSAGE);
    };

    window.__equipgestorShowSuccessToast = present;
    window.addEventListener('equipgestor:success-toast', onToast);

    return () => {
      if (window.__equipgestorShowSuccessToast === present) {
        delete window.__equipgestorShowSuccessToast;
      }
      window.removeEventListener('equipgestor:success-toast', onToast);
      clearTimers();
    };
  }, []);

  if (!mounted || !open) return null;

  const toast: ReactNode = (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <div
        className={`rounded-xl border border-zinc-200 bg-white px-6 py-3.5 text-base font-medium text-zinc-800 shadow-lg shadow-zinc-900/15 transition-all duration-300 ease-out ${
          visible ? 'translate-y-0 opacity-100' : '-translate-y-6 opacity-0'
        }`}
      >
        {message}
      </div>
    </div>
  );

  return createPortal(toast, document.body);
}
