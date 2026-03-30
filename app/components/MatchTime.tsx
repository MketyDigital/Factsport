'use client';
import { useEffect, useState } from 'react';

export default function MatchTime({ date }: { date: string }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 🟢 FIXED: Removed hardcoded text-sm so parent classes apply correctly
  if (!isMounted) {
    return <span className="opacity-0 font-mono font-bold inline-block min-w-[35px]">--:--</span>;
  }

  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) return <span>--:--</span>;

  return (
    <time dateTime={date} className="font-mono font-bold tracking-tighter">
      {dateObj.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
      })}
    </time>
  );
}