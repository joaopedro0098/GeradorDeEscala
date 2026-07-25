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
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -right-32 -top-24 h-[420px] w-[420px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-28 -left-28 h-[360px] w-[360px] rounded-full bg-gold/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="absolute -inset-3 rounded-[1.75rem] bg-gradient-to-br from-primary/15 via-gold/10 to-primary/5 blur-2xl" />

        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-xl shadow-primary/10 sm:p-8">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p> : null}
          <div className="mt-7">{children}</div>
        </div>
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
    <label className="block text-sm font-medium text-foreground">
      {label}
      <input
        className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-base text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20 sm:text-sm"
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

  return <p className={`rounded-xl border px-3.5 py-2.5 text-sm ${styles}`}>{message}</p>;
}

export function PrimaryButton({
  label,
  fullWidth = true,
}: {
  label: string;
  /** When false, button sizes to its label (use for card save actions). */
  fullWidth?: boolean;
}) {
  return (
    <button
      type="submit"
      className={`${
        fullWidth ? 'w-full' : 'inline-flex w-auto'
      } rounded-xl bg-[var(--btn-primary-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-primary-text)] shadow-md transition hover:bg-[var(--btn-primary-hover)]`}
    >
      {label}
    </button>
  );
}
