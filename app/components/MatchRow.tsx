'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Zap, Ticket } from 'lucide-react';

export default function MatchRow({ match }: { match: any }) {
  // Initialize with Database Data (Instant Load)
  const [data, setData] = useState({
    status: match.status,
    home_score: match.home_score,
    away_score: match.away_score,
    clock: match.clock || '',
  });

  useEffect(() => {
    // 🧠 SMART LOGIC: Only fetch if match is LIVE or STARTING SOON
    const now = new Date();
    const matchTime = new Date(match.match_date);
    const isLive = data.status === 'LIVE' || data.status === 'in' || 
                   (now >= matchTime && data.status !== 'FT' && data.status !== 'FINISHED');

    if (!isLive) return;

    const fetchScore = async () => {
      try {
        const res = await fetch(`/api/match/${match.id}`);
        if (res.ok) {
          const json = await res.json();
          setData({
            status: json.status === 'in' ? 'LIVE' : json.status,
            home_score: json.home.score,
            away_score: json.away.score,
            clock: json.displayClock
          });
        }
      } catch (e) {
        // console.error(e);
      }
    };

    // Fetch immediately and then every minute
    fetchScore();
    const interval = setInterval(fetchScore, 60000);
    return () => clearInterval(interval);
  }, []); // Run once on mount

  return (
    <div className="block hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
        {/* Clickable Match Area */}
        <Link href={`/match/${match.id}`} className="block p-4">
            <div className="flex items-center justify-between">
                
                {/* Status / Time Column */}
                <div className="flex flex-col items-center justify-center w-12 border-r border-slate-100 pr-3 mr-3 shrink-0">
                    {data.status === 'LIVE' || data.status === 'in' ? (
                        <div className="text-center">
                            <span className="text-[9px] font-black text-red-600 animate-pulse block mb-1">LIVE</span>
                            <span className="text-[9px] font-bold text-red-600 block">
                                {data.clock ? `${data.clock}'` : 'ON'}
                            </span>
                        </div>
                    ) : (data.status === 'FINISHED' || data.status === 'FT') ? (
                        <span className="text-[10px] font-black text-slate-400">FT</span>
                    ) : (
                        <div className="text-center">
                            <span className="text-[10px] font-bold text-slate-800 block">
                                {new Date(match.match_date).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'})}
                            </span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 block">
                                {new Date(match.match_date).getDate() === new Date().getDate() ? 'Today' : new Date(match.match_date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                            </span>
                        </div>
                    )}
                </div>

                {/* Teams & Scores */}
                <div className="flex-1 space-y-2">
                    {/* Home Team */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                {match.home_logo ? <img src={match.home_logo} className="w-full h-full object-contain" /> : <div className="w-4 h-4 bg-slate-200 rounded-full"></div>}
                            </div>
                            <span className="text-xs font-bold text-slate-800 line-clamp-1">{match.home_team}</span>
                        </div>
                        {(data.status === 'LIVE' || data.status === 'in' || data.status === 'FINISHED' || data.status === 'FT') && (
                            <span className={`text-xs font-black ${data.status === 'LIVE' || data.status === 'in' ? 'text-red-600' : 'text-slate-900'}`}>{data.home_score}</span>
                        )}
                    </div>

                    {/* Away Team */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                {match.away_logo ? <img src={match.away_logo} className="w-full h-full object-contain" /> : <div className="w-4 h-4 bg-slate-200 rounded-full"></div>}
                            </div>
                            <span className="text-xs font-bold text-slate-800 line-clamp-1">{match.away_team}</span>
                        </div>
                        {(data.status === 'LIVE' || data.status === 'in' || data.status === 'FINISHED' || data.status === 'FT') && (
                            <span className={`text-xs font-black ${data.status === 'LIVE' || data.status === 'in' ? 'text-red-600' : 'text-slate-900'}`}>{data.away_score}</span>
                        )}
                    </div>
                </div>
            </div>
        </Link>

        {/* Action Buttons Footer */}
        <div className="px-4 pb-3 pt-0 flex gap-2">
            <Link 
                href={`/match/${match.id}`} 
                className="flex-1 flex items-center justify-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg py-2 text-[10px] font-bold text-slate-600 active:scale-95 transition hover:bg-white hover:border-blue-200 hover:text-blue-600"
            >
                <Zap size={12} className="text-yellow-500 fill-yellow-500" /> Predict
            </Link>
            
            {match.booking_code ? (
                <button className="flex-1 flex items-center justify-center gap-1.5 bg-[#1A1A1A] text-yellow-400 rounded-lg py-2 text-[10px] font-bold active:scale-95 transition">
                    <Ticket size={12} /> {match.booking_code}
                </button>
            ) : (
                <Link 
                    href="/vip/upgrade" 
                    className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg py-2 text-[10px] font-bold active:scale-95 transition hover:bg-green-100"
                >
                    <Ticket size={12} /> Bet Now
                </Link>
            )}
        </div>
    </div>
  );
}