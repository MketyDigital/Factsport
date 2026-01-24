'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Zap, Ticket } from 'lucide-react';

export default function MatchRow({ match }: { match: any }) {
  const [data, setData] = useState({
    status: match.status,
    home_score: match.home_score,
    away_score: match.away_score,
    clock: match.clock || '',
  });

  useEffect(() => {
    const now = new Date();
    const matchTime = new Date(match.match_date);
    const isLive = ['LIVE', 'in'].includes(data.status) || 
                   (now >= matchTime && !['FT', 'post', 'FINISHED'].includes(data.status));

    if (!isLive) return;

    const fetchScore = async () => {
      try {
        const res = await fetch(`/api/match/${match.id}`);
        if (res.ok) {
          const json = await res.json();
          setData({
            status: json.status,
            home_score: json.home.score,
            away_score: json.away.score,
            clock: json.displayClock
          });
        }
      } catch (e) {}
    };

    fetchScore();
    const interval = setInterval(fetchScore, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="block hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
        <Link href={`/match/${match.id}`} className="block p-4">
            <div className="flex items-center justify-between">
                <div className="flex flex-col items-center justify-center w-12 border-r border-slate-100 pr-3 mr-3 shrink-0">
                    {['LIVE', 'in'].includes(data.status) ? (
                        <div className="text-center">
                            <span className="text-[9px] font-black text-red-600 animate-pulse block mb-1">LIVE</span>
                            <span className="text-[9px] font-bold text-red-600 block">{data.clock ? `${data.clock}'` : 'ON'}</span>
                        </div>
                    ) : (['FT', 'post', 'FINISHED'].includes(data.status)) ? (
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

                <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                {match.home_logo ? <img src={match.home_logo} className="w-full h-full object-contain" /> : <div className="w-4 h-4 bg-slate-200 rounded-full"></div>}
                            </div>
                            <span className="text-xs font-bold text-slate-800 line-clamp-1">{match.home_team}</span>
                        </div>
                        {['LIVE', 'in', 'FT', 'post', 'FINISHED'].includes(data.status) && (
                            <span className={`text-xs font-black ${['LIVE', 'in'].includes(data.status) ? 'text-red-600' : 'text-slate-900'}`}>{data.home_score}</span>
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                {match.away_logo ? <img src={match.away_logo} className="w-full h-full object-contain" /> : <div className="w-4 h-4 bg-slate-200 rounded-full"></div>}
                            </div>
                            <span className="text-xs font-bold text-slate-800 line-clamp-1">{match.away_team}</span>
                        </div>
                        {['LIVE', 'in', 'FT', 'post', 'FINISHED'].includes(data.status) && (
                            <span className={`text-xs font-black ${['LIVE', 'in'].includes(data.status) ? 'text-red-600' : 'text-slate-900'}`}>{data.away_score}</span>
                        )}
                    </div>
                </div>
            </div>
        </Link>

        <div className="px-4 pb-3 pt-0 flex gap-2">
            <Link href={`/match/${match.id}`} className="flex-1 flex items-center justify-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg py-2 text-[10px] font-bold text-slate-600 active:scale-95 transition hover:bg-white">
                <Zap size={12} className="text-yellow-500 fill-yellow-500" /> Predict
            </Link>
            {match.booking_code ? (
                <button className="flex-1 flex items-center justify-center gap-1.5 bg-[#1A1A1A] text-yellow-400 rounded-lg py-2 text-[10px] font-bold active:scale-95 transition">
                    <Ticket size={12} /> {match.booking_code}
                </button>
            ) : (
                <Link href="/vip/upgrade" className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg py-2 text-[10px] font-bold transition hover:bg-green-100">
                    <Ticket size={12} /> Bet Now
                </Link>
            )}
        </div>
    </div>
  );
}