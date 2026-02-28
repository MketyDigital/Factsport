'use client';

import { useEffect, useState } from 'react';

export default function MatchTime({ date }: { date: string }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 🟢 FIXED: Stays completely invisible on the server to prevent Hydration Flashing
  if (!isMounted) {
    return <span className="opacity-0 font-mono font-bold text-sm inline-block min-w-[40px]">--:--</span>;
  }

  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) return <span>--:--</span>;

  return (
    <time dateTime={date} className="font-mono font-bold text-sm">
      {dateObj.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
      })}
    </time>
  );
}