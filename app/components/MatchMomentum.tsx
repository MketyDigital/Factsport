'use client';
import { Activity } from 'lucide-react';

export default function MatchMomentum({ events }: { events: any[] }) {
    if (!events || events.length === 0) return null;

    const buckets = Array.from({ length: 19 }, () => ({ home: 0, away: 0 }));

    events.forEach(e => {
        if (e.type === 'sub' || e.type === 'card' || e.type === 'var_overturn') return; 

        let timeStr = e.time?.replace("'", "") || "0";
        let time = parseInt(timeStr.split('+')[0]) || 0;
        if (time > 90) time = 90; 

        const bucketIndex = Math.floor(time / 5);
        if (bucketIndex >= 0 && bucketIndex < buckets.length) {
            const weight = e.type === 'goal' ? 4 : 1; 
            if (e.team === 'home') buckets[bucketIndex].home += weight;
            if (e.team === 'away') buckets[bucketIndex].away += weight;
        }
    });

    const maxScore = Math.max(2, ...buckets.map(b => Math.max(b.home, b.away)));

    return (
        <div className="w-full bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4 shadow-inner">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Activity size={14} className="text-blue-500" /> Match Flow
                </h4>
                <div className="flex items-center gap-3 text-[8px] font-bold uppercase tracking-widest text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-sm"></span> Home</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-sm"></span> Away</span>
                </div>
            </div>

            <div className="relative h-20 md:h-24 w-full flex items-center justify-between gap-[1px] md:gap-[2px]">
                
                <div className="absolute left-0 w-full h-[2px] bg-slate-200 top-1/2 -translate-y-1/2 z-0 rounded-full"></div>

                {buckets.map((b, i) => {
                    const hHeight = (b.home / maxScore) * 50; 
                    const aHeight = (b.away / maxScore) * 50;

                    return (
                        <div key={i} className="flex-1 flex flex-col h-full justify-center relative group z-10 cursor-crosshair">
                            
                            <div className="flex-1 flex items-end w-full pb-[1px]">
                                <div
                                    className="w-full bg-blue-500 rounded-t-[1px] md:rounded-t-sm grow-up"
                                    style={{ height: `${hHeight}%`, minHeight: b.home > 0 ? '3px' : '0px', animationDelay: `${i * 50}ms` }}
                                ></div>
                            </div>
                            
                            <div className="flex-1 flex items-start w-full pt-[1px]">
                                <div
                                    className="w-full bg-red-500 rounded-b-[1px] md:rounded-b-sm grow-down"
                                    style={{ height: `${aHeight}%`, minHeight: b.away > 0 ? '3px' : '0px', animationDelay: `${i * 50}ms` }}
                                ></div>
                            </div>

                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg">
                                {i * 5}'-{(i + 1) * 5}'
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div className="flex justify-between mt-2 text-[7px] md:text-[8px] font-bold text-slate-400">
                <span>0'</span>
                <span>HT</span>
                <span>90'</span>
            </div>

            <style jsx>{`
                .grow-up {
                    transform-origin: bottom;
                    animation: growY 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards;
                }
                .grow-down {
                    transform-origin: top;
                    animation: growY 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards;
                }
                @keyframes growY {
                    0% { transform: scaleY(0); opacity: 0; }
                    100% { transform: scaleY(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}