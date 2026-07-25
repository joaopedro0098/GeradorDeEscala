'use client';

import { useEffect, useState } from 'react';
import { ScheduleAdminView } from '@/components/scheduling/schedule-admin-view';
import { OfflineScheduleBanner } from '@/components/scheduling/offline-schedule-banner';
import {
  resolveOfflineScheduleView,
  saveLastScheduleView,
} from '@/lib/schedule-offline-cache';
import type {
  ScheduleAssignmentCandidate,
  ScheduleOverview,
  ShortageEntryView,
} from '@/modules/scheduling/schedule.types';
import type { YearMonth } from '@/modules/scheduling/working-month.logic';

export function ScheduleAdminPageClient({
  organizationId,
  workingMonth,
  viewedMonth,
  isHistory,
  historyMonths,
  serverOverview,
  shortagePreview,
  assignmentCandidates,
  availabilityLocked,
}: {
  organizationId: string;
  workingMonth: YearMonth;
  viewedMonth: YearMonth;
  isHistory: boolean;
  historyMonths: YearMonth[];
  serverOverview: ScheduleOverview | null;
  shortagePreview: ShortageEntryView[];
  assignmentCandidates: ScheduleAssignmentCandidate[];
  availabilityLocked: boolean;
}) {
  const [isOnline, setIsOnline] = useState(true);
  const [resolved, setResolved] = useState(() =>
    resolveOfflineScheduleView({
      audience: 'admin',
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
          audience: 'admin',
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
    saveLastScheduleView('admin', organizationId, {
      year: viewedMonth.year,
      month: viewedMonth.month,
      overview: serverOverview,
    });
  }, [isOnline, organizationId, viewedMonth, serverOverview]);

  const isCached = resolved.mode === 'cached';
  const displayMonth =
    isCached && resolved.cachedYear && resolved.cachedMonth
      ? { year: resolved.cachedYear, month: resolved.cachedMonth }
      : viewedMonth;

  return (
    <div className="space-y-4">
      <OfflineScheduleBanner
        mode={resolved.mode}
        cachedAt={resolved.cachedAt}
        cachedYear={resolved.cachedYear}
        cachedMonth={resolved.cachedMonth}
        requestedYear={viewedMonth.year}
        requestedMonth={viewedMonth.month}
      />
      <ScheduleAdminView
        workingMonth={workingMonth}
        viewedMonth={displayMonth}
        isHistory={isHistory}
        historyMonths={historyMonths}
        overview={resolved.overview}
        shortagePreview={isCached ? [] : shortagePreview}
        assignmentCandidates={isCached ? [] : assignmentCandidates}
        availabilityLocked={
          isCached ? Boolean(resolved.overview?.availabilityLocked) : availabilityLocked
        }
        readOnly={isCached || isHistory}
        isOffline={isCached}
      />
    </div>
  );
}
