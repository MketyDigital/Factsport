'use client';

import { useEffect, useState } from 'react';

export default function MatchTime({ date }: { date: string }) {
  const [localTime, setLocalTime] = useState<string | null>(null);

  useEffect(() => {
    const dateObj = new Date(date);
    
    // Check if date is valid
    if (!isNaN(dateObj.getTime())) {
      setLocalTime(
        dateObj.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true // Change to false for 24h format (e.g. 14:00)
        })
      );
    } else {
      setLocalTime('--:--');
    }
  }, [date]);

  // 🟢 FIXED: Prevent hydration flicker. 
  // Renders invisibly on the server/first load to hold the layout space, 
  // then fades in smoothly with the exact client local time.
  if (!localTime) {
    return <span className="font-mono font-bold text-sm opacity-0">--:--</span>;
  }

  return (
    <time 
      dateTime={date} 
      className="font-mono font-bold text-sm animate-in fade-in duration-300"
    >
      {localTime}
    </time>
  );
}