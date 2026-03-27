'use client';

import { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useSmartInterval } from '@/app/hooks/useSmartInterval';
import { fetchLiveMatchDeduplicated } from '@/app/utils/liveFetcher';

const MatchLiveContext = createContext<any>(null);

export function MatchLiveProvider({ espnId, initialData, children }: { espnId: string | null, initialData: any, children: React.ReactNode }) {
    const [liveData, setLiveData] = useState(initialData);
    const isFetching = useRef(false);
    
    const currentStatus = (liveData?.status || '').toUpperCase();
    const isFinished = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(currentStatus);
    const isLive = ['LIVE', 'HT', 'IN_PLAY', '1H', '2H', 'ET', 'P'].includes(currentStatus);

    const fetchUpdates = async () => {
        if (isFinished || !espnId || isFetching.current) return;
        
        isFetching.current = true;
        try {
            // 🟢 USES THE GLOBAL DEDUPLICATOR
            const data = await fetchLiveMatchDeduplicated(espnId);
            
            if (data && !data.error) {
                setLiveData((prev: any) => {
                    const eventsChanged = (prev.events?.length || 0) !== (data.events?.length || 0);
                    if (
                        prev.status === data.status && 
                        prev.home_score === data.home_score && 
                        prev.away_score === data.away_score && 
                        prev.displayClock === data.displayClock && 
                        !eventsChanged
                    ) {
                        return prev;
                    }
                    
                    return {
                        ...prev,
                        status: data.status,
                        home_score: data.home_score,
                        away_score: data.away_score,
                        displayClock: data.displayClock,
                        stats: data.stats || prev.stats,
                        lineups: data.lineups?.home?.length > 0 ? data.lineups : prev.lineups,
                        events: data.events || data.match_events || prev.events,
                        match_events: data.events || data.match_events || prev.match_events
                    };
                });
            }
        } catch (e) {
            console.error("Live sync error", e);
        } finally {
            isFetching.current = false;
        }
    };

    // 🟢 FIX 1: Sync if Next.js Router soft-navigates and provides newer server data
    useEffect(() => {
        setLiveData(initialData);
    }, [initialData]);

    // 🟢 FIX 2: Force an immediate fetch on mount to overwrite stale Next.js cache
    useEffect(() => {
        if (espnId && !isFinished) {
            fetchUpdates();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [espnId]);

    let pollInterval = null;
    if (!isFinished && espnId) {
        pollInterval = isLive ? 3000 : 60000;
    }

    useSmartInterval(fetchUpdates, pollInterval);

    return (
        <MatchLiveContext.Provider value={liveData}>
            {children}
        </MatchLiveContext.Provider>
    );
}

export const useMatchLive = () => useContext(MatchLiveContext);