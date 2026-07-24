'use client';

function formatMonthYear(year: number, month: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function OfflineScheduleBanner({
  mode,
  cachedAt,
  cachedYear,
  cachedMonth,
  requestedYear,
  requestedMonth,
}: {
  mode: 'live' | 'cached' | 'unavailable';
  cachedAt: string | null;
  cachedYear: number | null;
  cachedMonth: number | null;
  requestedYear: number;
  requestedMonth: number;
}) {
  if (mode === 'live') return null;

  if (mode === 'unavailable') {
    return (
      <p className="rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
        Sem conexão e nenhuma escala salva neste dispositivo. Conecte-se à internet para carregar a
        escala.
      </p>
    );
  }

  const samePeriod =
    cachedYear === requestedYear && cachedMonth === requestedMonth && cachedYear !== null;
  const savedLabel = cachedAt
    ? new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(cachedAt))
    : null;

  return (
    <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
      <span className="font-medium">Modo offline — leitura da última escala salva.</span>{' '}
      {samePeriod
        ? 'Exibindo a escala deste período salva localmente'
        : cachedYear && cachedMonth
          ? `Exibindo ${formatMonthYear(cachedYear, cachedMonth)} (última escala visualizada)`
          : 'Exibindo a última escala visualizada'}
      {savedLabel ? ` · salva em ${savedLabel}` : ''}.
    </p>
  );
}
