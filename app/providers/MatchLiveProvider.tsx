'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useSmartInterval } from '@/app/hooks/useSmartInterval';

const MatchLiveContext = createContext<any>(null);

export function MatchLiveProvider({ espnId, initialData, children }: { espnId: string, initialData: any, children: React.ReactNode }) {
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
                        // O(1) Shallow Diff: Only update React if things actually changed
                        if (prev.status === data.status && prev.home_score === data.home_score && prev.away_score === data.away_score && prev.displayClock === data.displayClock && (prev.events?.length || 0) === (data.events?.length || 0)) {
                            return prev;
                        }
                        return data;
                    });
                }
            }
        } catch (e) {
        } finally {
            isFetching.current = false;
        }
    };

    // 🟢 THE SINGLE MASTER POLLER: Runs once every 5 seconds for the entire page
    useSmartInterval(fetchUpdates, !isFinished ? 5000 : null);

    return (
        <MatchLiveContext.Provider value={liveData}>
            {children}
        </MatchLiveContext.Provider>
    );
}

export const useMatchLive = () => useContext(MatchLiveContext);