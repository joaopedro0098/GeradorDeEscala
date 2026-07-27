'use client';

import { useEffect, useState } from 'react';
import { ScheduleMemberView } from '@/components/scheduling/schedule-member-view';
import {
  resolveOfflineScheduleView,
  saveLastScheduleView,
} from '@/lib/schedule-offline-cache';
import type { ScheduleOverview } from '@/modules/scheduling/schedule.types';
import type { YearMonth } from '@/modules/scheduling/working-month.logic';

export function ScheduleMemberPageClient({
  organizationId,
  workingMonth,
  viewedMonth,
  isHistory,
  historyMonths,
  initialSelectedDate,
  serverOverview,
}: {
  organizationId: string;
  workingMonth: YearMonth;
  viewedMonth: YearMonth;
  isHistory: boolean;
  historyMonths: YearMonth[];
  initialSelectedDate?: string | null;
  serverOverview: ScheduleOverview | null;
}) {
  const [isOnline, setIsOnline] = useState(true);
  const [resolved, setResolved] = useState(() =>
    resolveOfflineScheduleView({
      audience: 'member',
      organizationId,
      year: viewedMonth.year,
      month: viewedMonth.month,
      serverOverview,
      isOnline: true,
    }),
  );

  useEffect(() => {
    function syncConnectivity() {
      const online = window.navigator.onLine;
      setIsOnline(online);
      setResolved(
        resolveOfflineScheduleView({
          audience: 'member',
          organizationId,
          year: viewedMonth.year,
          month: viewedMonth.month,
          serverOverview,
          isOnline: online,
        }),
      );
    }

    syncConnectivity();
    window.addEventListener('online', syncConnectivity);
    window.addEventListener('offline', syncConnectivity);
    return () => {
      window.removeEventListener('online', syncConnectivity);
      window.removeEventListener('offline', syncConnectivity);
    };
  }, [organizationId, viewedMonth, serverOverview]);

  useEffect(() => {
    if (!isOnline || !serverOverview) return;
    saveLastScheduleView('member', organizationId, {
      year: viewedMonth.year,
      month: viewedMonth.month,
      selectedDate: initialSelectedDate,
      overview: serverOverview,
    });
  }, [isOnline, organizationId, viewedMonth, initialSelectedDate, serverOverview]);

  const isCached = resolved.mode === 'cached';
  const displayMonth =
    isCached && resolved.cachedYear && resolved.cachedMonth
      ? { year: resolved.cachedYear, month: resolved.cachedMonth }
      : viewedMonth;
  const displaySelectedDate =
    isCached && resolved.cachedYear !== viewedMonth.year ? null : initialSelectedDate;

  return (
    <ScheduleMemberView
      workingMonth={workingMonth}
      viewedMonth={displayMonth}
      isHistory={isHistory}
      historyMonths={historyMonths}
      initialSelectedDate={displaySelectedDate}
      overview={resolved.overview}
      readOnly={isCached}
      isOffline={isCached}
    />
  );
}
