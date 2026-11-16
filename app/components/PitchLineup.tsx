'use client';
import { useState } from 'react';
import { Shield } from 'lucide-react';

export default function PitchLineup({ data, dbData }: { data: any, dbData: any }) {
    const [activeTab, setActiveTab] = useState<'home' | 'away'>('home');

    // 1. Safely extract data
    const lineups = data?.lineups;
    if (!lineups || !lineups.home || lineups.home.length === 0) {
        return (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-xs font-bold uppercase tracking-widest flex flex-col items-center justify-center h-[300px]">
                Lineups not yet available
            </div>
        );
    }

    const homeTeamName = dbData?.home_team || 'Home';
    const awayTeamName = dbData?.away_team || 'Away';
    
    // 2. Filter only the starters (ignoring the bench for the pitch view)
    const starters = lineups[activeTab].filter((p: any) => p.is_starter);
    const bench = lineups[activeTab].filter((p: any) => !p.is_starter);
    
    // 3. Parse the formation (e.g. "4-2-3-1" -> [4, 2, 3, 1])
    const rawFormation = lineups.formations?.[activeTab] || '4-3-3'; // Fallback to 4-3-3
    const formationArray = rawFormation.split('-').map(Number);

    // 4. Distribute players into rows (Goalkeeper is always Row 0)
    // We slice the starters array based on the formation numbers.
    let currentIndex = 1; // Start at 1 because index 0 is the GK
    const rows = [ [starters[0]] ]; // Row 0: Goalkeeper

    formationArray.forEach((count: number) => {
        rows.push(starters.slice(currentIndex, currentIndex + count));
        currentIndex += count;
    });

    const activeColor = activeTab === 'home' ? 'bg-blue-600' : 'bg-red-600';

    return (
        <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            
            {/* TABS */}
            <div className="flex border-b border-slate-100">
                <button 
                    onClick={() => setActiveTab('home')}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'home' ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}
                >
                    {homeTeamName}
                </button>
                <button 
                    onClick={() => setActiveTab('away')}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'away' ? 'text-red-600 bg-red-50 border-b-2 border-red-600' : 'text-slate-400 hover:bg-slate-50'}`}
                >
                    {awayTeamName}
                </button>
            </div>

            <div className="p-4 bg-[#F0F2F5]">
                {/* 🟢 THE 2D PITCH */}
                <div className="relative w-full aspect-[3/4] max-w-md mx-auto bg-[linear-gradient(160deg,#247a4d,#145c3d)] rounded-2xl overflow-hidden border-4 border-white/70 shadow-[0_15px_28px_rgba(15,52,35,0.22)]" role="group" aria-label={`${activeTab === 'home' ? homeTeamName : awayTeamName} starting eleven pitch`}>
                    
                    {/* Pitch Markings (CSS Drawn) */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-40 pointer-events-none flex flex-col">
                        {/* Grass stripes */}
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className={`flex-1 w-full ${i % 2 === 0 ? 'bg-white/5' : 'bg-transparent'}`}></div>
                        ))}
                    </div>
                    
                    {/* Center Circle & Halfway Line (Top) */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 border-2 border-white/40 rounded-full -translate-y-1/2 pointer-events-none"></div>
                    <div className="absolute top-0 left-0 w-full h-0 border-t-2 border-white/40 pointer-events-none"></div>

                    {/* Penalty Box (Bottom) */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[50%] h-[18%] border-2 border-white/40 border-b-0 pointer-events-none flex justify-center">
                        {/* 6-Yard Box */}
                        <div className="absolute bottom-0 w-[40%] h-[40%] border-2 border-white/40 border-b-0"></div>
                        {/* Penalty Arc */}
                        <div className="absolute -top-[20%] w-12 h-12 border-2 border-white/40 rounded-full clip-half-top"></div>
                    </div>

                    {/* 🟢 PLAYER POSITIONS */}
                    <div className="absolute inset-0 flex flex-col justify-between py-6 px-2 z-10">
                        {/* We reverse the rows so Attackers are at the top, GK at the bottom */}
                        {rows.slice().reverse().map((row, rowIndex) => (
                            <div key={rowIndex} className="flex justify-around items-center w-full">
                                {row.map((player: any, pIndex: number) => {
                                    if (!player) return null;
                                    return (
                                        <div key={pIndex} className="flex flex-col items-center group" aria-label={`${player.name}, number ${player.number || 'unknown'}`}>
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-[11px] font-black shadow-[0_7px_10px_rgba(0,0,0,0.35)] ring-2 ring-white/80 border border-white/30 mb-1 ${activeColor} fs-visual-card-interactive`}>
                                                {player.number || <Shield size={12}/>}
                                            </div>
                                            <span className="text-[8px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded shadow-sm text-center max-w-[60px] truncate border border-white/10 backdrop-blur-sm">
                                                {player.name.split(' ').pop()} {/* Shows Last Name */}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                {/* THE BENCH */}
                {bench.length > 0 && (
                    <div className="mt-4 bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            Substitutes
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                            {bench.map((player: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 text-[10px] font-bold text-slate-700">
                                    <span className="w-5 h-5 bg-slate-100 rounded text-[8px] flex items-center justify-center text-slate-500 shrink-0">
                                        {player.number || '-'}
                                    </span>
                                    <span className="truncate">{player.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>

            <style jsx>{`
                .clip-half-top {
                    clip-path: polygon(0 0, 100% 0, 100% 50%, 0 50%);
                }
            `}</style>
        </div>
    );
}