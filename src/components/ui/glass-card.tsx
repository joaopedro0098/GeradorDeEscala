import type { ReactNode } from 'react';

export function GlassCard({
  children,
  className = '',
  tone = 'light',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'light' | 'frost';
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--glass-border)] shadow-[0_8px_32px_-12px_rgba(15,23,42,0.18)] backdrop-blur-[var(--glass-blur)] ${
        tone === 'frost' ? 'bg-[var(--glass-bg)]' : 'bg-[var(--glass-bg-light)]'
      } ${className}`}
    >
      {children}
    </section>
  );
}
