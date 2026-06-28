export const runtime = 'edge';
export const revalidate = 60;

import { createClient } from '@supabase/supabase-js'; 
import Link from 'next/link';
import { Metadata, ResolvingMetadata } from 'next';
import { ChevronLeft, Trophy, Calendar, CheckCircle, Search, CalendarDays, BarChart2 } from 'lucide-react';
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';
import LeagueMatchGroup from '@/app/components/LeagueMatchGroup';
import LiveStandings from '@/app/components/LiveStandings';

export async function generateMetadata({ params }: { params: { league: string } }, parent: ResolvingMetadata): Promise<Metadata> {
    const resolvedParams = await params;
    const leagueName = decodeURIComponent(resolvedParams.league);
    
    return {
        title: `${leagueName} Live Scores, Standings & Results | FactSport`,
        description: `Follow the ${leagueName}. Get live scores, official group standings, and match results.`,
    };
}

export default async function TournamentDetailsPage({ params }: { params: { league: string } }) {
    const resolvedParams = await params;
    const leagueName = decodeURIComponent(resolvedParams.league);

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const now = new Date();
    const startOfWindow = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(); 
    const endOfWindow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .eq('league', leagueName)
        .gte('match_date', startOfWindow)
        .lte('match_date', endOfWindow)
        .order('match_date', { ascending: true });

    return (
        <div className="min-h-screen bg-[#F0F2F5] pb-24 font-sans text-slate-900 selection:bg-blue-200">
            
            <div className="bg-[#0a1428] border-b border-blue-900/30 text-white pt-8 pb-10 px-6 relative overflow-hidden shadow-lg sticky top-0 z-50 backdrop-blur-lg">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>

                <div className="relative z-10 max-w-5xl mx-auto flex items-center justify-between">
                    <div>
                        <Link href="/tournaments" className="text-xs font-bold text-slate-400 hover:text-white mb-4 inline-flex items-center gap-1 transition-colors">
                            <ChevronLeft size={14}/> Back to Hub
                        </Link>
                        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter flex items-center gap-3 drop-shadow-md">
                            <Trophy className="text-yellow-500" size={32} /> {leagueName}
                        </h1>
                        <p className="text-blue-300 font-bold tracking-widest mt-2 text-[10px] md:text-xs uppercase">Live Matches, Results & Standings</p>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 mt-6">
                <AdsterraStandardBanner />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                    <div className="lg:col-span-2">
                        {matches && matches.length > 0 ? (
                            <LeagueMatchGroup leagueName={`${leagueName} Matches`} matches={matches} />
                        ) : (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center text-slate-400 flex flex-col items-center">
                                <CalendarDays size={48} className="mb-4 opacity-30 text-blue-500" />
                                <h3 className="text-xl font-black text-slate-700 mb-2 uppercase tracking-tight">No Active Matches</h3>
                                <p className="font-medium text-sm">There are no matches scheduled for the {leagueName} in the current window.</p>
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-[#0a1428] rounded-2xl p-6 shadow-xl border border-slate-800 text-center relative overflow-hidden group">
                             <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                             <h3 className="text-white font-black uppercase tracking-widest text-sm mb-2 relative z-10">Tournament Standings</h3>
                             <p className="text-slate-400 text-xs font-medium mb-4 relative z-10">View official group tables and knockout brackets.</p>
                             <Link href={`/standings?league=${encodeURIComponent(leagueName)}`} className="bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-widest py-3 px-6 rounded-xl inline-flex items-center gap-2 shadow-lg transition-all active:scale-95 relative z-10 w-full justify-center">
                                 <BarChart2 size={16} /> View Standings
                             </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}