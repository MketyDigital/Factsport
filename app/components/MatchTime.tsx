'use client';

import { useEffect, useState } from 'react';

export default function MatchTime({ date }: { date: string }) {
  // Option 1: The "Safe" Way (Prevents Flicker)
  // We render the time, but tell React to ignore the mismatch between Server (UTC) and Client (Local)
  
  const dateObj = new Date(date);

  // Check if date is valid
  if (isNaN(dateObj.getTime())) return <span>--:--</span>;

  return (
    <time 
      dateTime={date} 
      suppressHydrationWarning 
      className="font-mono font-bold text-sm"
    >
      {dateObj.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true // Change to false for 24h format (e.g. 14:00)
      })}
    </time>
  );
}