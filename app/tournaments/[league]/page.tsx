export const runtime = 'edge';
export const revalidate = 60;

import { createClient } from '@supabase/supabase-js'; 
import Link from 'next/link';
import { Metadata, ResolvingMetadata } from 'next';
import { ChevronLeft, Trophy, Calendar, CheckCircle, Search, CalendarDays, BarChart2, Star, Shield, Info, MapPin } from 'lucide-react';
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';
import LeagueMatchGroup from '@/app/components/LeagueMatchGroup';
import LiveStandings from '@/app/components/LiveStandings';

export async function generateMetadata({ params }: { params: Promise<{ league: string }> }, parent: ResolvingMetadata): Promise<Metadata> {
    const resolvedParams = await params;
    const leagueName = decodeURIComponent(resolvedParams.league);
    
    return {
        title: `${leagueName} Live Scores, Standings & Results | FactSport`,
        description: `Follow the ${leagueName}. Get live scores, official group standings, and match results.`,
    };
}

// Map leagues to custom luxury brand styling
const LEAGUE_STYLES: Record<string, { themeClass: string; gradient: string; accent: string; year: string }> = {
    'World Cup': {
        themeClass: 'from-[#8A2387] via-[#E94057] to-[#F27121]',
        gradient: 'bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-700',
        accent: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
        year: '2026 USA, Canada & Mexico'
    },
    'Euros': {
        themeClass: 'from-[#00c6ff] to-[#0072ff]',
        gradient: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-800',
        accent: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
        year: 'Continental Masterclass'
    },
    'Champions League': {
        themeClass: 'from-[#1f4068] via-[#162447] to-[#1b1a17]',
        gradient: 'bg-gradient-to-r from-[#112240] via-[#0a192f] to-[#1b1a17]',
        accent: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10',
        year: 'UEFA Champions League'
    },
    'Copa America': {
        themeClass: 'from-[#11998e] to-[#38ef7d]',
        gradient: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-green-700',
        accent: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
        year: 'South American Flair'
    },
    'AFCON': {
        themeClass: 'from-[#F3904F] to-[#3B4371]',
        gradient: 'bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-700',
        accent: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
        year: 'African Cup of Nations'
    }
};


export default async function TournamentDetailsPage({ params }: { params: Promise<{ league: string }> }) {
    const resolvedParams = await params;
    const leagueName = decodeURIComponent(resolvedParams.league);

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const now = new Date();
    const startOfWindow = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(); 
    const endOfWindow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: dbMatches } = await supabase
        .from('matches')
        .select('*')
        .eq('league', leagueName)
        .gte('match_date', startOfWindow)
        .lte('match_date', endOfWindow)
        .order('match_date', { ascending: true });

    // Use DB matches or empty array if none
    const matches = dbMatches || [];

    const style = LEAGUE_STYLES[leagueName] || {
        themeClass: 'from-[#1e293b] to-[#0f172a]',
        gradient: 'bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900',
        accent: 'text-slate-400 border-slate-700/30 bg-slate-700/10',
        year: 'Global Stage'
    };

    const hasLive = matches.some(m => ['LIVE', '1H', '2H', 'HT', 'ET', 'P', 'IN_PLAY'].includes(m.status));

    return (
        <div className="min-h-screen bg-[#070d19] text-white pb-24 font-sans selection:bg-blue-600/30 select-none">
            
            {/* BRANDED JUMBOTRON HEADER */}
            <div className={`relative overflow-hidden pt-6 pb-12 px-4 md:px-8 border-b border-white/5`}>
                {/* Background color block based on the league theme */}
                <div className={`absolute inset-0 bg-gradient-to-br ${style.themeClass} opacity-15 mix-blend-color-dodge`}></div>
                <div className="absolute inset-0 bg-radial-gradient(ellipse_60%_80%_at_50%_-20%,rgba(59,130,246,0.15),transparent)"></div>
                
                <div className="relative z-10 max-w-6xl mx-auto space-y-4">
                    <div className="flex items-center justify-between">
                        <Link href="/tournaments" className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white inline-flex items-center gap-1.5 transition-colors bg-white/5 border border-white/5 px-3.5 py-2 rounded-xl">
                            <ChevronLeft size={13} className="text-blue-500" /> Tournaments Hub
                        </Link>
                        {hasLive && (
                            <span className="bg-red-600 text-white text-[8px] md:text-[9px] font-black px-2.5 py-1 rounded-md tracking-[0.15em] uppercase flex items-center gap-1 animate-pulse border border-red-500 shadow-lg">
                                <span className="w-1.5 h-1.5 bg-white rounded-full"></span> Matches Live Now
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-4">
                        <div className="space-y-2">
                            <span className={`inline-block text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-md border ${style.accent}`}>
                                {style.year}
                            </span>
                            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-white drop-shadow-lg flex items-center gap-3">
                                <Trophy className="text-yellow-500 shrink-0" size={32} /> {leagueName}
                            </h1>
                            <p className="text-slate-400 text-xs font-semibold leading-relaxed tracking-wide max-w-xl">
                                Official bracket, livescores, head-to-heads, and tournament statistics. Fully synchronized from sports commentary terminals.
                            </p>
                        </div>

                        {/* Quick Stats Panel */}
                        <div className="bg-[#0f1c3a]/80 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex items-center gap-6 shadow-xl shrink-0">
                            <div>
                                <span className="text-[8px] text-slate-400 font-black tracking-widest uppercase block">Match Count</span>
                                <span className="text-lg font-black text-white">{matches.length} Matches</span>
                            </div>
                            <div className="w-px h-8 bg-white/10"></div>
                            <div>
                                <span className="text-[8px] text-slate-400 font-black tracking-widest uppercase block">Live Data</span>
                                <span className="text-xs font-black text-green-400 uppercase tracking-wider flex items-center gap-1 mt-1">
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></span> Active
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* BODY COMPONENT LAYOUT */}
            <div className="max-w-6xl mx-auto px-4 mt-8 space-y-8">
                <AdsterraStandardBanner />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* LEFT COLUMN: MATCHES & BRACKET */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                            <CalendarDays size={16} className="text-blue-500" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">
                                Schedule & Bracket Hub
                            </h3>
                        </div>
                        
                        <LeagueMatchGroup leagueName={`${leagueName} Matches`} matches={matches} />
                    </div>

                    {/* RIGHT COLUMN: STANDINGS PREVIEW */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                            <BarChart2 size={16} className="text-yellow-500" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">
                                Tournament Standings
                            </h3>
                        </div>

                        <div className="bg-[#0f1c3a]/80 backdrop-blur-md rounded-3xl shadow-2xl border border-white/5 overflow-hidden">
                             <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#0a1428]/80">
                                 <h3 className="text-white font-black uppercase tracking-widest text-[10px] flex items-center gap-1.5">
                                     <Star size={12} className="text-yellow-500" /> Group Table
                                 </h3>
                                 <Link 
                                     href={`/standings?league=${encodeURIComponent(leagueName)}`} 
                                     className="text-[9px] text-blue-400 font-black uppercase tracking-wider hover:text-blue-300 bg-white/5 px-2.5 py-1 rounded-md border border-white/5 transition-colors"
                                 >
                                     Full Standings
                                 </Link>
                             </div>
                             <div className="p-3">
                                 <LiveStandings leagueName={leagueName} />
                             </div>
                        </div>

                        {/* SYSTEM INFO TIP */}
                        <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-4 flex gap-3">
                            <Info className="text-blue-400 shrink-0 mt-0.5" size={16} />
                            <div>
                                <span className="text-[9px] font-black uppercase tracking-wider text-blue-400 block mb-1">FactSport Smart Engine</span>
                                <p className="text-slate-300 text-[11px] font-medium leading-relaxed">
                                    When teams tie in points, rankings are calculated based on Head-to-Head results, followed by Goal Difference, then Goals Scored according to official tournament regulations.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}