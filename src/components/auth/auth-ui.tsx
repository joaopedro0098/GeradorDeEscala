import type { ReactNode } from 'react';

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm text-zinc-600">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  name,
  type = 'text',
  required = true,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm font-medium text-zinc-800">
      {label}
      <input
        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base outline-none ring-zinc-900 focus:ring-2 sm:text-sm"
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
      />
    </label>
  );
}

export function Alert({ message, tone }: { message: string; tone: 'error' | 'success' }) {
  const styles =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  return <p className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>{message}</p>;
}

export function PrimaryButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
    >
      {label}
    </button>
  );
}
