'use client';

import { useEffect, useRef } from 'react';

export function useSmartInterval(callback: () => void, delay: number | null) {
    const savedCallback = useRef(callback);

    // Remember the latest callback
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    // Set up the interval and visibility listener
    useEffect(() => {
        if (delay === null) return;

        let intervalId: NodeJS.Timeout;
        const tick = () => savedCallback.current();

        const startPolling = () => {
            intervalId = setInterval(tick, delay);
        };

        const stopPolling = () => {
            if (intervalId) clearInterval(intervalId);
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopPolling(); // 🛑 Phone locked: Kill the interval
            } else {
                tick(); // 🟢 Phone unlocked: Fetch immediately...
                startPolling(); // ...and restart the clock
            }
        };

        if (!document.hidden) startPolling();
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            stopPolling();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [delay]);
}