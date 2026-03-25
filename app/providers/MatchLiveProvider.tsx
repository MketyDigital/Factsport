'use client';

import { createContext, useContext, useState, useRef } from 'react';
import { useSmartInterval } from '@/app/hooks/useSmartInterval';

const MatchLiveContext = createContext<any>(null);

export function MatchLiveProvider({ espnId, initialData, children }: { espnId: string | null, initialData: any, children: React.ReactNode }) {
    const [liveData, setLiveData] = useState(initialData);
    const isFetching = useRef(false);
    
    const currentStatus = (liveData?.status || '').toUpperCase();
    const isFinished = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(currentStatus);

    const fetchUpdates = async () => {
        if (isFinished || !espnId || isFetching.current) return;
        
        isFetching.current = true;
        try {
            const res = await fetch(`https://live-api.factsport.com/?espn_id=${espnId}`);
            if (res.ok) {
                const data = await res.json();
                if (!data.error) {
                    setLiveData((prev: any) => {
                        // O(1) Shallow Diff: Only trigger React renders if data actually changed!
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
                        
                        // Merge the new live data with the existing initial structure
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
            }
        } catch (e) {
        } finally {
            isFetching.current = false;
        }
    };

    // 🟢 THE SINGLE MASTER POLLER: Runs once every 5 seconds for the entire page
    useSmartInterval(fetchUpdates, !isFinished && espnId ? 5000 : null);

    return (
        <MatchLiveContext.Provider value={liveData}>
            {children}
        </MatchLiveContext.Provider>
    );
}

export const useMatchLive = () => useContext(MatchLiveContext);