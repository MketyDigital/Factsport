export const runtime = 'edge';
export const revalidate = 60; 

import { createClient } from '@supabase/supabase-js'; 
import Link from 'next/link';
import { Metadata } from 'next';
import { ChevronRight, Trophy, Calendar, Zap, ArrowRight, ShieldCheck, Star } from 'lucide-react';
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';

export const metadata: Metadata = {
  title: 'Global Football Tournaments | FactSport',
  description: 'Follow the biggest football tournaments in the world. Get live scores, standings, and knockouts for the World Cup, Euros, Champions League, and more.',
};

const TOURNAMENTS = [
    { name: 'World Cup', id: 'World Cup', type: 'fifa', bg: 'from-amber-600 to-red-900', icon: '🌍' },
    { name: 'Euros', id: 'Euros', type: 'uefa', bg: 'from-blue-600 to-blue-900', icon: '🇪🇺' },
    { name: 'Champions League', id: 'Champions League', type: 'uefa', bg: 'from-slate-800 to-indigo-900', icon: '⭐' },
    { name: 'Copa America', id: 'Copa America', type: 'conmebol', bg: 'from-yellow-500 to-green-800', icon: '🌎' },
    { name: 'AFCON', id: 'AFCON', type: 'caf', bg: 'from-green-600 to-amber-800', icon: '🦁' },
];

export default async function TournamentsPage() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const { data: activeMatches } = await supabase
    .from('matches')
    .select('league, status')
    .in('status', ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET', 'P']);

  const liveLeagues = new Set(activeMatches?.map(m => m.league));

  return (
    <div className="min-h-screen bg-[#0a1428] text-white pb-24 font-sans">
      
      <div className="bg-[#0f1c3a] border-b border-white/10 text-white p-6 sticky top-0 z-50 shadow-2xl backdrop-blur-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div>
                  <h1 className="font-black text-2xl md:text-3xl leading-none italic uppercase flex items-center gap-3 tracking-tighter">
                      <Trophy className="text-yellow-500"/> Tournaments Hub
                  </h1>
                  <p className="text-xs text-slate-400 font-bold tracking-widest mt-1">THE BIGGEST STAGES IN WORLD FOOTBALL</p>
              </div>
          </div>
      </div>

      <div className="p-4 max-w-7xl mx-auto mt-6">
        <AdsterraStandardBanner />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {TOURNAMENTS.map(t => {
                const isLive = liveLeagues.has(t.id);
                return (
                    <Link key={t.id} href={`/tournaments/${encodeURIComponent(t.id)}`} className={`relative rounded-3xl overflow-hidden shadow-2xl border border-white/10 group bg-gradient-to-br ${t.bg} hover:shadow-[0_10px_40px_rgba(0,0,0,0.8)] transition-all duration-300 hover:-translate-y-1`}>
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-500"></div>
                        
                        <div className="relative p-8 h-full flex flex-col justify-between min-h-[220px]">
                            <div className="flex justify-between items-start">
                                <span className="text-4xl drop-shadow-lg">{t.icon}</span>
                                {isLive && (
                                    <span className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-lg uppercase tracking-widest animate-pulse flex items-center gap-1 border border-red-500">
                                        <span className="w-1.5 h-1.5 bg-white rounded-full"></span> LIVE MATCHES
                                    </span>
                                )}
                            </div>

                            <div className="mt-8">
                                <h2 className="text-2xl font-black uppercase tracking-tight drop-shadow-md text-white group-hover:text-yellow-400 transition-colors">
                                    {t.name}
                                </h2>
                                <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">Match Center & Standings</p>
                            </div>

                            <div className="mt-6 flex items-center text-white/50 group-hover:text-white font-black text-xs uppercase tracking-widest transition-colors">
                                Explore <ArrowRight size={14} className="ml-2 group-hover:translate-x-2 transition-transform"/>
                            </div>
                        </div>
                    </Link>
                );
            })}
        </div>
      </div>
    </div>
  );
}