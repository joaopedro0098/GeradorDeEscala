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

export function ScheduleAdminPageClient({
  organizationId,
  initialYear,
  initialMonth,
  serverOverview,
  shortagePreview,
  assignmentCandidates,
}: {
  organizationId: string;
  initialYear: number;
  initialMonth: number;
  serverOverview: ScheduleOverview | null;
  shortagePreview: ShortageEntryView[];
  assignmentCandidates: ScheduleAssignmentCandidate[];
}) {
  const [isOnline, setIsOnline] = useState(true);
  const [resolved, setResolved] = useState(() =>
    resolveOfflineScheduleView({
      audience: 'admin',
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
          audience: 'admin',
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
    saveLastScheduleView('admin', organizationId, {
      year: initialYear,
      month: initialMonth,
      overview: serverOverview,
    });
  }, [isOnline, organizationId, initialYear, initialMonth, serverOverview]);

  const displayOverview = resolved.overview;
  const displayYear =
    resolved.mode === 'cached' && resolved.cachedYear ? resolved.cachedYear : initialYear;
  const displayMonth =
    resolved.mode === 'cached' && resolved.cachedMonth ? resolved.cachedMonth : initialMonth;

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
      <ScheduleAdminView
        initialYear={displayYear}
        initialMonth={displayMonth}
        overview={displayOverview}
        shortagePreview={resolved.mode === 'live' ? shortagePreview : []}
        assignmentCandidates={resolved.mode === 'live' ? assignmentCandidates : []}
        readOnly={resolved.mode === 'cached'}
      />
    </div>
  );
}
