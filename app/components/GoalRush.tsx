'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Flame } from 'lucide-react';

export default function GoalRush({ initialMatches }: { initialMatches: any[] }) {
    const [matches, setMatches] = useState(initialMatches);
    const [flashingIds, setFlashingIds] = useState<string[]>([]);
    
    const prevMatchesRef = useRef(initialMatches);

    useEffect(() => {
        if (!initialMatches || initialMatches.length === 0) return;

        const fetchUpdates = async () => {
            const updated = await Promise.all(matches.map(async (m) => {
                try {
                    let res;
                    if (m.espn_id) {
                        res = await fetch(`https://fse.mkpoikankes.workers.dev/?espn_id=${m.espn_id}&t=${Date.now()}`);
                    } else {
                        res = await fetch(`/api/match-data?id=${m.id}&t=${Date.now()}`);
                    }
                    
                    if (res.ok) {
                        const data = await res.json();
                        if (!data.error) {
                            return { ...m, status: data.status, home_score: data.home_score, away_score: data.away_score, clock: data.displayClock };
                        }
                    }
                } catch(e) {}
                return m;
            }));
            
            const newFlashes: string[] = [];
            updated.forEach(newMatch => {
                const oldMatch = prevMatchesRef.current.find((old: any) => old.id === newMatch.id);
                if (oldMatch) {
                    if (newMatch.home_score > oldMatch.home_score || newMatch.away_score > oldMatch.away_score) {
                        newFlashes.push(newMatch.id);
                    }
                }
            });

            if (newFlashes.length > 0) {
                setFlashingIds(prev => [...prev, ...newFlashes]);
                setTimeout(() => {
                    setFlashingIds(prev => prev.filter(id => !newFlashes.includes(id)));
                }, 5000);
            }

            prevMatchesRef.current = updated;
            setMatches(updated);
        };

        const interval = setInterval(fetchUpdates, 5000); // 🟢 5 SECONDS
        return () => clearInterval(interval);
    }, [matches]);

    if (!matches || matches.length === 0) return null;

    return (
        <div className="w-full bg-[#0a1428] rounded-2xl shadow-xl border border-blue-900/30 py-3 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-3xl rounded-full pointer-events-none"></div>

            <div className="flex overflow-x-auto scrollbar-hide gap-3 px-4 items-center relative z-10">
                <div className="text-[10px] font-black text-red-500 uppercase tracking-widest shrink-0 flex items-center gap-1.5 mr-2 bg-red-500/10 px-2 py-1 rounded-md border border-red-500/20">
                    <Flame size={12} className="animate-pulse" /> Goal Rush
                </div>

                {matches.map(m => {
                    const isHT = ['HT', 'HALFTIME'].includes(m.status?.toUpperCase());
                    const isFinished = ['FT', 'FINISHED'].includes(m.status?.toUpperCase());
                    const isFlashing = flashingIds.includes(m.id);

                    return (
                        <Link 
                            key={m.id} 
                            href={`/match/${m.id}`} 
                            className={`shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-full border transition-all duration-500 ${
                                isFlashing 
                                ? 'bg-green-500/20 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.3)] scale-105' 
                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                        >
                            <span className="text-[11px] font-bold text-slate-200">{m.home_team}</span>
                            
                            <span className={`text-[11px] font-black px-2 py-0.5 rounded shadow-md transition-colors duration-500 ${
                                isFlashing ? 'bg-green-500 text-white' : 'bg-black/60 text-white border border-white/5'
                            }`}>
                                {m.home_score} - {m.away_score}
                            </span>
                            
                            <span className="text-[11px] font-bold text-slate-200">{m.away_team}</span>
                            
                            <span className={`text-[9px] font-black ml-1 ${isHT ? 'text-amber-500' : isFinished ? 'text-slate-400' : 'text-red-400 animate-pulse'}`}>
                                {isFinished ? 'FT' : (m.clock || (isHT ? 'HT' : 'LIVE'))}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}