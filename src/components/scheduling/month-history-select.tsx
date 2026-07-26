'use client';

import { useRouter } from 'next/navigation';
import { formatYearMonth, type YearMonth } from '@/modules/scheduling/working-month.logic';

/**
 * Month picker for the schedule screens: the working month is the only editable
 * option, past months open the same screen in read-only mode.
 */
export function MonthHistorySelect({
  basePath,
  workingMonth,
  viewedMonth,
  isHistory,
  historyMonths,
  disabled = false,
}: {
  basePath: string;
  workingMonth: YearMonth;
  viewedMonth: YearMonth;
  isHistory: boolean;
  historyMonths: YearMonth[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const value = isHistory ? `${viewedMonth.year}-${viewedMonth.month}` : '';

  function handleChange(nextValue: string) {
    if (!nextValue) {
      router.push(basePath);
      return;
    }
    const [year, month] = nextValue.split('-');
    router.push(`${basePath}?year=${year}&month=${month}`);
  }

  return (
    <label className="block">
      <span className="sr-only">Mês</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => handleChange(event.target.value)}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm capitalize text-zinc-900 disabled:opacity-60"
      >
        <option value="">{formatYearMonth(workingMonth)} (mês de trabalho)</option>
        {historyMonths.map((month) => (
          <option key={`${month.year}-${month.month}`} value={`${month.year}-${month.month}`}>
            {formatYearMonth(month)}
          </option>
        ))}
      </select>
    </label>
  );
}
