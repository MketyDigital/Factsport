'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AutoRefresh({ interval = 60000 }: { interval?: number }) {
  const router = useRouter();

  useEffect(() => {
    const fetchUpdates = () => {
        // Only refresh if the user is actually looking at the tab (saves server costs!)
        if (document.visibilityState === 'visible') {
            router.refresh();
        }
    };

    const timerId = setInterval(fetchUpdates, interval);
    
    // Also refresh immediately when the user switches back to this tab
    document.addEventListener('visibilitychange', fetchUpdates);

    return () => {
        clearInterval(timerId);
        document.removeEventListener('visibilitychange', fetchUpdates);
    };
  }, [router, interval]);

  return null; // This component is completely invisible
}