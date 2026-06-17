// app/providers/MatchLiveProvider.tsx

'use client';

import { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useSmartInterval } from '@/app/hooks/useSmartInterval';
import { fetchLiveMatchDeduplicated } from '@/app/utils/liveFetcher';

const MatchLiveContext = createContext<any>(null);

const TERMINAL_STATUSES = new Set(['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD']);
const LIVE_STATUSES = new Set(['LIVE', 'HT', 'IN_PLAY', '1H', '2H', 'ET', 'P', 'PENALTIES']);
const PRE_STATUSES = new Set(['SCHEDULED', 'PRE', 'NS', 'UPCOMING', 'TBD', 'TIMED']);

const stringify = (value: any) => {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return '';
  }
};

const hasRichLineups = (lineups: any) => {
  return Boolean(
    lineups &&
    (
      (Array.isArray(lineups.home) && lineups.home.length > 0) ||
      (Array.isArray(lineups.away) && lineups.away.length > 0)
    )
  );
};

const hasRichStats = (stats: any) => {
  return Boolean(
    stats &&
    (
      Object.keys(stats.home || {}).length > 0 ||
      Object.keys(stats.away || {}).length > 0 ||
      stats.home_penalties !== undefined ||
      stats.away_penalties !== undefined ||
      stats.home_ht !== undefined ||
      stats.away_ht !== undefined
    )
  );
};

export function MatchLiveProvider({
  espnId,
  initialData,
  children
}: {
  espnId: string | null;
  initialData: any;
  children: React.ReactNode;
}) {
  const [liveData, setLiveData] = useState(initialData);
  const isFetching = useRef(false);

  const currentStatus = String(liveData?.status || '').toUpperCase();
  const isFinished = TERMINAL_STATUSES.has(currentStatus);
  const isLive = LIVE_STATUSES.has(currentStatus);

  const matchDateMs = initialData?.match_date ? new Date(initialData.match_date).getTime() : 0;
  const minutesToKick = Number.isFinite(matchDateMs)
    ? (matchDateMs - Date.now()) / 60000
    : 999999;

  const shouldPollScheduled =
    PRE_STATUSES.has(currentStatus) &&
    minutesToKick <= 180 &&
    minutesToKick > -180;

  const fetchUpdates = async () => {
    if (isFinished || !espnId || isFetching.current) return;

    isFetching.current = true;

    try {
      const data = await fetchLiveMatchDeduplicated(espnId);

      if (!data || data.error) return;

      const nextStatus = String(data.status || '').toUpperCase();
      const nextFinished = TERMINAL_STATUSES.has(nextStatus);

      setLiveData((prev: any) => {
        const prevEventsLength = prev?.events?.length || prev?.match_events?.length || 0;
        const nextEventsLength = data?.events?.length || data?.match_events?.length || 0;
        const eventsChanged = prevEventsLength !== nextEventsLength;

        const sameStatus = prev?.status === data.status;
        const sameHomeScore = Number(prev?.home_score ?? 0) === Number(data.home_score ?? 0);
        const sameAwayScore = Number(prev?.away_score ?? 0) === Number(data.away_score ?? 0);
        const sameClock = prev?.displayClock === data.displayClock;
        const lineupsChanged = stringify(prev?.lineups) !== stringify(data?.lineups);
        const statsChanged = stringify(prev?.stats) !== stringify(data?.stats);

        if (
          !eventsChanged &&
          !lineupsChanged &&
          !statsChanged &&
          sameStatus &&
          sameHomeScore &&
          sameAwayScore &&
          sameClock
        ) {
          return prev;
        }

        const nextEvents =
          Array.isArray(data.events) && data.events.length > 0
            ? data.events
            : Array.isArray(data.match_events) && data.match_events.length > 0
              ? data.match_events
              : prev?.events || prev?.match_events || [];

        return {
          ...prev,
          status: data.status ?? prev?.status,
          home_score: data.home_score ?? prev?.home_score,
          away_score: data.away_score ?? prev?.away_score,
          displayClock: data.displayClock ?? prev?.displayClock,
          stats: hasRichStats(data.stats) ? data.stats : prev?.stats,
          lineups: hasRichLineups(data.lineups) ? data.lineups : prev?.lineups,
          events: nextEvents,
          match_events: nextEvents,
          venue: data.venue ?? prev?.venue,
          referees: data.referees ?? prev?.referees,
          predictor: data.predictor ?? prev?.predictor,
          stage: data.stage ?? prev?.stage,
          match_group: data.match_group ?? prev?.match_group,
          match_type: data.match_type ?? prev?.match_type,
          round: data.round ?? prev?.round,
          group_summary: data.group_summary ?? prev?.group_summary,
          knockout: data.knockout ?? prev?.knockout,
          final: data.final ?? prev?.final
        };
      });

      if (nextFinished) {
        setLiveData((prev: any) => ({
          ...prev,
          status: data.status
        }));
      }
    } catch (e) {
      console.error('Live sync error', e);
    } finally {
      isFetching.current = false;
    }
  };

  useEffect(() => {
    setLiveData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (espnId) {
      fetchUpdates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [espnId]);

  let pollInterval: number | null = null;

  if (!isFinished && espnId && (isLive || shouldPollScheduled)) {
    pollInterval = isLive ? 3000 : 30000;
  }

  useSmartInterval(fetchUpdates, pollInterval);

  return (
    <MatchLiveContext.Provider value={liveData}>
      {children}
    </MatchLiveContext.Provider>
  );
}

export const useMatchLive = () => useContext(MatchLiveContext);