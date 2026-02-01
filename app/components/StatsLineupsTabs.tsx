'use client';
import { useState } from 'react';
import { BarChart2, Users } from 'lucide-react';

function StatBar({ label, h, a, suffix = "" }: any) {
    const total = (h + a) || 1;
    const pct = (h / total) * 100;
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-[10px] font-bold text-slate-500">
            <span>{h}{suffix}</span><span className="uppercase text-slate-300 text-[9px] tracking-wider">{label}</span><span>{a}{suffix}</span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full flex overflow-hidden">
            <div className="h-full bg-blue-600" style={{ width: `${pct}%` }}></div><div className="h-full bg-red-600 flex-1"></div>
        </div>
      </div>
    );
}

function RosterList({ title, players }: any) {
    return (
        <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
            <div className="border-b border-slate-100 pb-2 mb-2 font-black text-[10px] text-slate-400 uppercase">{title}</div>
            <ul className="space-y-1">
                {players.length > 0 ? players.map((p:any) => (
                    <li key={p.athlete?.id || Math.random()} className="text-[10px] font-bold text-slate-600 flex gap-2">
                        <span className="text-slate-300 w-4">{p.jersey}</span> {p.athlete?.displayName || "Player"}
                    </li>
                )) : <li className="text-[10px] text-slate-300 italic">Not available</li>}
            </ul>
        </div>
    )
}

export default function StatsLineupsTabs({ data }: any) {
    const [tab, setTab] = useState('stats');

    return (
        <div className="mt-6">
            <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-100 mb-4">
                <button onClick={() => setTab('stats')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition flex items-center justify-center gap-1 ${tab === 'stats' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}>
                    <BarChart2 size={12} /> Stats
                </button>
                <button onClick={() => setTab('lineups')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition flex items-center justify-center gap-1 ${tab === 'lineups' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}>
                    <Users size={12} /> Lineups
                </button>
            </div>

            {tab === 'stats' ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-5">
                    <StatBar label="Possession" h={data.stats.possession.h} a={data.stats.possession.a} suffix="%" />
                    <StatBar label="Shots" h={data.stats.shots.h} a={data.stats.shots.a} />
                    <StatBar label="Corners" h={data.stats.corners.h} a={data.stats.corners.a} />
                    <StatBar label="Fouls" h={data.stats.fouls.h} a={data.stats.fouls.a} />
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    <RosterList title="Home" players={data.lineups.home} />
                    <RosterList title="Away" players={data.lineups.away} />
                </div>
            )}
        </div>
    );
}