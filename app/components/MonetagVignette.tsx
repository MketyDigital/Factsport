'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function MonetagVignette() {
    const pathname = usePathname();

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        const checkAndLoadAd = () => {
            const lastShown = localStorage.getItem('monetag_last_shown');
            const now = new Date().getTime();
            
            // 🟢 DEFAULT: 25mins, little Delay (for /matches, /standings, etc.)
            let hoursToWait = 0.25; 
            let delayMs = 5000; 

            // 🟢 PAGE-SPECIFIC STRATEGY
            if (pathname.startsWith('/highlights')) {
                // Aggressive: Every 10 mins, Instant Pop-up
                hoursToWait = 0.1; 
            } else if (pathname === '/') {
                // Homepage: 4 a day, 1-minute delay (60,000 ms)
                hoursToWait = 4; 
                delayMs = 60000; 
            } else if (pathname.startsWith('/match/')) {
                // Match Details: Every 1/2 hour, 1/2-minute delay (30,000 ms)
                // The trailing slash prevents it from matching '/matches'!
                hoursToWait = 0.5;
                delayMs = 30000;
            }

            const timeLimit = hoursToWait * 60 * 60 * 1000;

            if (!lastShown || now - parseInt(lastShown) > timeLimit) {
                const injectAd = () => {
                    // Double check we haven't already injected it
                    if (!document.querySelector('script[data-zone="10740759"]')) {
                        const script = document.createElement('script');
                        script.dataset.zone = '10740759';
                        script.src = 'https://gizokraijaw.net/vignette.min.js';
                        script.async = true;
                        
                        document.body.appendChild(script);
                        
                        // Stamp the exact time they saw it
                        localStorage.setItem('monetag_last_shown', new Date().getTime().toString());
                    }
                };

                // Trigger with or without delay
                if (delayMs > 0) {
                    timeoutId = setTimeout(injectAd, delayMs);
                } else {
                    injectAd();
                }
            }
        };

        checkAndLoadAd();

        // 🟢 Cleanup: Cancel the timer if they leave the page before the delay finishes
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [pathname]);

    return null;
}