export const runtime = 'edge';
export const revalidate = 60; 

import { createClient } from '@supabase/supabase-js'; 
import Link from 'next/link';
import { Metadata } from 'next';
import { ChevronRight, Trophy, Calendar, Zap, ArrowRight, ShieldCheck, Star, Sparkles, Award, Globe, Users } from 'lucide-react';
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';

export const metadata: Metadata = {
  title: 'Global Football Tournaments | FactSport',
  description: 'Follow the biggest football tournaments in the world. Get live scores, standings, and knockouts for the World Cup, Euros, Champions League, and more.',
};

const TOURNAMENTS = [
    { 
        name: 'World Cup', 
        id: 'World Cup', 
        type: 'FIFA International', 
        bg: 'from-[#8A2387] via-[#E94057] to-[#F27121]', 
        icon: '🌍',
        teams: '48 Teams',
        edition: '2026 USA, Canada & Mexico',
        tagline: 'The supreme pinnacle of global football. Witness history unfold across North America.',
        badgeColor: 'text-amber-400 bg-amber-400/10 border-amber-400/20'
    },
    { 
        name: 'Euros', 
        id: 'Euros', 
        type: 'UEFA European Championship', 
        bg: 'from-[#00c6ff] to-[#0072ff]', 
        icon: '🇪🇺',
        teams: '24 Teams',
        edition: 'European Masterclass',
        tagline: 'The fierce battle for continental supremacy. Elite tactics, pure drama.',
        badgeColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20'
    },
    { 
        name: 'Champions League', 
        id: 'Champions League', 
        type: 'UEFA Club Championship', 
        bg: 'from-[#1f4068] via-[#162447] to-[#1b1a17]', 
        icon: '⭐',
        teams: '36 Teams (New Phase)',
        edition: 'Elite Club Stage',
        tagline: 'The ultimate stage for club prestige. Under the lights, champions are crowned.',
        badgeColor: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20'
    },
    { 
        name: 'Copa America', 
        id: 'Copa America', 
        type: 'CONMEBOL South America', 
        bg: 'from-[#11998e] to-[#38ef7d]', 
        icon: '🌎',
        teams: '16 Teams',
        edition: 'Samba & Passion',
        tagline: 'Uncompromising grit, jaw-dropping flair, and the oldest continental competition.',
        badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
    },
    { 
        name: 'AFCON', 
        id: 'AFCON', 
        type: 'CAF African Cup of Nations', 
        bg: 'from-[#F3904F] to-[#3B4371]', 
        icon: '🦁',
        teams: '24 Teams',
        edition: 'African Glory',
        tagline: 'Rich heritage, unbelievable raw energy, and breathtaking matches.',
        badgeColor: 'text-orange-400 bg-orange-400/10 border-orange-400/20'
    },
];

export default async function TournamentsPage() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const { data: activeMatches } = await supabase
    .from('matches')
    .select('league, status')
    .in('status', ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET', 'P']);

  const liveLeagues = new Set(activeMatches?.map(m => m.league));

  return (
    <div className="min-h-screen bg-[#0a1428] text-white pb-24 font-sans select-none">
      
      {/* HEADER */}
      <div className="bg-[#0f1c3a]/90 border-b border-white/5 text-white p-6 sticky top-0 z-50 shadow-2xl backdrop-blur-xl">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div>
                  <h1 className="font-black text-2xl md:text-3xl leading-none italic uppercase flex items-center gap-3 tracking-tighter">
                      <Trophy className="text-yellow-500 shrink-0" size={26} /> Tournaments Hub
                  </h1>
                  <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1.5 uppercase">Explore The Grandest Arenas in Football</p>
              </div>
          </div>
      </div>

      <div className="p-4 max-w-7xl mx-auto mt-6 space-y-8">
        <AdsterraStandardBanner />

        {/* HERO INTRO CARD */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-[#101f3f] to-slate-900 border border-slate-800 p-6 md:p-10 shadow-xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(59,130,246,0.12),transparent)]"></div>
            <div className="relative z-10 max-w-3xl space-y-4">
                <span className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-wider text-blue-400">
                    <Sparkles size={11} className="animate-spin text-yellow-400" style={{ animationDuration: '4s' }} /> Live Tournament Coverage
                </span>
                <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-white leading-tight">
                    The Global Football <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500 font-black">Championship Stages</span>
                </h2>
                <p className="text-slate-300 text-xs md:text-sm font-medium leading-relaxed max-w-2xl">
                    Get up-to-the-second livescores, official group standings, live tournament commentary, and full bracket structures. Our server architecture is streamlined to handle peak live traffic with zero lag.
                </p>
                
                {/* Stats panel inside Hero */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800/85">
                    <div>
                        <span className="text-slate-400 text-[9px] font-black tracking-widest uppercase block">Updated</span>
                        <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Real-Time (UTC)
                        </span>
                    </div>
                    <div>
                        <span className="text-slate-400 text-[9px] font-black tracking-widest uppercase block">Coverage</span>
                        <span className="text-xs font-black text-white uppercase tracking-wider mt-0.5">5 Cups & Leagues</span>
                    </div>
                    <div className="hidden sm:block">
                        <span className="text-slate-400 text-[9px] font-black tracking-widest uppercase block">Database Status</span>
                        <span className="text-xs font-black text-blue-400 uppercase tracking-wider mt-0.5">Fully Synchronized</span>
                    </div>
                </div>
            </div>
        </div>

        {/* TOURNAMENTS LIST */}
        <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                <Globe size={16} className="text-blue-500" />
                <h3 className="font-black text-xs uppercase tracking-widest text-slate-300">Featured Competitions</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {TOURNAMENTS.map(t => {
                    const isLive = liveLeagues.has(t.id);
                    return (
                        <Link 
                            key={t.id} 
                            href={`/tournaments/${encodeURIComponent(t.id)}`} 
                            className="relative rounded-3xl overflow-hidden border border-white/5 group bg-[#0f1c3a]/75 hover:bg-[#13234b]/80 hover:border-blue-500/30 shadow-xl hover:shadow-[0_12px_45px_rgba(0,0,0,0.65)] transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between"
                        >
                            {/* Hover light highlight */}
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                            <div className="p-6 md:p-8 space-y-6 flex-1 flex flex-col justify-between">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="w-14 h-14 bg-slate-900/60 rounded-2xl flex items-center justify-center text-3xl shadow-md border border-slate-800">
                                        {t.icon}
                                    </div>
                                    {isLive ? (
                                        <span className="bg-red-600 text-white text-[9px] font-black px-2.5 py-1 rounded shadow-lg uppercase tracking-widest animate-pulse flex items-center gap-1.5 border border-red-500">
                                            <span className="w-1.5 h-1.5 bg-white rounded-full"></span> LIVE
                                        </span>
                                    ) : (
                                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${t.badgeColor}`}>
                                            Active
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-400 block">
                                        {t.type}
                                    </span>
                                    <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white group-hover:text-yellow-400 transition-colors">
                                        {t.name}
                                    </h2>
                                    <p className="text-slate-400 text-[11px] font-medium leading-relaxed line-clamp-2">
                                        {t.tagline}
                                    </p>
                                </div>

                                <div className="border-t border-white/5 pt-4 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0">
                                    <span className="flex items-center gap-1"><Users size={12} className="text-slate-500"/> {t.teams}</span>
                                    <span className="text-slate-500">{t.edition}</span>
                                </div>
                            </div>

                            {/* BOTTOM TRIGGER AREA */}
                            <div className={`p-4 bg-gradient-to-r ${t.bg} flex items-center justify-between text-white text-xs font-black uppercase tracking-widest shrink-0 transition-all group-hover:brightness-110`}>
                                <span>Browse Tournament matches</span>
                                <ArrowRight size={14} className="group-hover:translate-x-1.5 transition-transform" />
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
      </div>
    </div>
  );
}