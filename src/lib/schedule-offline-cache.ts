import type { ScheduleOverview } from '@/modules/scheduling/schedule.types';

export type ScheduleAudience = 'member' | 'admin';

export type CachedScheduleView = {
  year: number;
  month: number;
  selectedDate?: string | null;
  overview: ScheduleOverview;
  savedAt: string;
};

const STORAGE_PREFIX = 'escala-offline:last';

function cacheKey(audience: ScheduleAudience, organizationId: string): string {
  return `${STORAGE_PREFIX}:${audience}:${organizationId}`;
}

export function saveLastScheduleView(
  audience: ScheduleAudience,
  organizationId: string,
  view: Omit<CachedScheduleView, 'savedAt'>,
): void {
  if (typeof window === 'undefined') return;

  const payload: CachedScheduleView = {
    ...view,
    savedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(cacheKey(audience, organizationId), JSON.stringify(payload));
}

export function loadLastScheduleView(
  audience: ScheduleAudience,
  organizationId: string,
): CachedScheduleView | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(cacheKey(audience, organizationId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CachedScheduleView;
    if (!parsed?.overview || typeof parsed.year !== 'number' || typeof parsed.month !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function resolveOfflineScheduleView(params: {
  audience: ScheduleAudience;
  organizationId: string;
  year: number;
  month: number;
  serverOverview: ScheduleOverview | null;
  isOnline: boolean;
}): {
  overview: ScheduleOverview | null;
  mode: 'live' | 'cached' | 'unavailable';
  cachedAt: string | null;
  cachedYear: number | null;
  cachedMonth: number | null;
} {
  const cached = loadLastScheduleView(params.audience, params.organizationId);

  if (params.isOnline) {
    if (params.serverOverview) {
      return {
        overview: params.serverOverview,
        mode: 'live',
        cachedAt: null,
        cachedYear: null,
        cachedMonth: null,
      };
    }
    return {
      overview: null,
      mode: 'unavailable',
      cachedAt: null,
      cachedYear: null,
      cachedMonth: null,
    };
  }

  if (!cached) {
    return {
      overview: null,
      mode: 'unavailable',
      cachedAt: null,
      cachedYear: null,
      cachedMonth: null,
    };
  }

  const samePeriod = cached.year === params.year && cached.month === params.month;
  return {
    overview: cached.overview,
    mode: 'cached',
    cachedAt: cached.savedAt,
    cachedYear: cached.year,
    cachedMonth: cached.month,
    ...(samePeriod
      ? {}
      : {
          // Caller can show that we're displaying the last saved month while offline.
        }),
  };
}
