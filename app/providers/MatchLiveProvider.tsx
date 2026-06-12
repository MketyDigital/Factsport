'use client';

import { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useSmartInterval } from '@/app/hooks/useSmartInterval';
import { fetchLiveMatchDeduplicated } from '@/app/utils/liveFetcher';

const MatchLiveContext = createContext<any>(null);

const TERMINAL_STATUSES = new Set(['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD']);
const LIVE_STATUSES = new Set(['LIVE', 'HT', 'IN_PLAY', '1H', '2H', 'ET', 'P', 'PENALTIES']);
const PRE_STATUSES = new Set(['SCHEDULED', 'PRE', 'NS', 'UPCOMING', 'TBD', 'TIMED']);

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
        const sameHomeScore = Number(prev?.home_score) === Number(data.home_score);
        const sameAwayScore = Number(prev?.away_score) === Number(data.away_score);
        const sameClock = prev?.displayClock === data.displayClock;

        if (!eventsChanged && sameStatus && sameHomeScore && sameAwayScore && sameClock) {
          return prev;
        }

        return {
          ...prev,
          status: data.status,
          home_score: data.home_score,
          away_score: data.away_score,
          displayClock: data.displayClock,
          stats: data.stats || prev.stats,
          lineups: data.lineups?.home?.length > 0 || data.lineups?.away?.length > 0
            ? data.lineups
            : prev.lineups,
          events: data.events || data.match_events || prev.events,
          match_events: data.events || data.match_events || prev.match_events
        };
      });

      if (nextFinished) {
        // This lets widgets know the match is over.
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