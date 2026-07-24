'use client';

import { useEffect, useState } from 'react';
import { ScheduleMemberView } from '@/components/scheduling/schedule-member-view';
import { OfflineScheduleBanner } from '@/components/scheduling/offline-schedule-banner';
import {
  resolveOfflineScheduleView,
  saveLastScheduleView,
} from '@/lib/schedule-offline-cache';
import type { ScheduleOverview } from '@/modules/scheduling/schedule.types';

export function ScheduleMemberPageClient({
  organizationId,
  initialYear,
  initialMonth,
  initialSelectedDate,
  serverOverview,
}: {
  organizationId: string;
  initialYear: number;
  initialMonth: number;
  initialSelectedDate?: string | null;
  serverOverview: ScheduleOverview | null;
}) {
  const [isOnline, setIsOnline] = useState(true);
  const [resolved, setResolved] = useState(() =>
    resolveOfflineScheduleView({
      audience: 'member',
      organizationId,
      year: initialYear,
      month: initialMonth,
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
          year: initialYear,
          month: initialMonth,
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
  }, [organizationId, initialYear, initialMonth, serverOverview]);

  useEffect(() => {
    if (!isOnline || !serverOverview) return;
    saveLastScheduleView('member', organizationId, {
      year: initialYear,
      month: initialMonth,
      selectedDate: initialSelectedDate,
      overview: serverOverview,
    });
  }, [isOnline, organizationId, initialYear, initialMonth, initialSelectedDate, serverOverview]);

  const displayOverview = resolved.overview;
  const displayYear =
    resolved.mode === 'cached' && resolved.cachedYear ? resolved.cachedYear : initialYear;
  const displayMonth =
    resolved.mode === 'cached' && resolved.cachedMonth ? resolved.cachedMonth : initialMonth;
  const displaySelectedDate =
    resolved.mode === 'cached' && resolved.cachedYear !== initialYear ? null : initialSelectedDate;

  return (
    <div className="space-y-4">
      <OfflineScheduleBanner
        mode={resolved.mode}
        cachedAt={resolved.cachedAt}
        cachedYear={resolved.cachedYear}
        cachedMonth={resolved.cachedMonth}
        requestedYear={initialYear}
        requestedMonth={initialMonth}
      />
      {displayOverview ? (
        <ScheduleMemberView
          initialYear={displayYear}
          initialMonth={displayMonth}
          initialSelectedDate={displaySelectedDate}
          overview={displayOverview}
          readOnly={resolved.mode === 'cached'}
        />
      ) : resolved.mode === 'unavailable' ? null : (
        <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          A escala deste mês ainda não foi publicada.
        </p>
      )}
    </div>
  );
}
