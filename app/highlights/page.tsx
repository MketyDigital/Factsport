export const runtime = 'edge';
export const revalidate = 60;

import { createClient } from '@supabase/supabase-js'; 
import Link from "next/link";
import { Metadata } from 'next';
import { PlayCircle, Calendar, ArrowLeft, Tv, ShieldCheck, Trophy, ArrowRight, ChevronRight, ChevronLeft } from "lucide-react";
import BettingPromo from '@/app/components/BettingPromo';
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';

const ITEMS_PER_PAGE = 12;

export const metadata: Metadata = {
  title: 'Football Highlights & Goal Replays | FactSport',
  description: 'Watch the latest football highlights, goal replays, and match recaps from the top leagues worldwide.',
  openGraph: {
      title: 'Football Highlights & Goal Replays | FactSport',
      description: 'Watch the latest football highlights, goal replays, and match recaps from the top leagues worldwide.',
      type: 'website',
      siteName: 'FactSport',
  },
  twitter: {
      card: 'summary_large_image',
      title: 'Football Highlights & Goal Replays | FactSport',
      description: 'Watch the latest football highlights, goal replays, and match recaps from the top leagues worldwide.',
  }
};

export default async function HighlightsPage({ searchParams }: { searchParams: { league?: string, page?: string } }) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const resolvedParams = await searchParams;
  
  const currentLeague = resolvedParams.league || 'All';
  const currentPage = parseInt(resolvedParams.page || '1');

  const from = (currentPage - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  const { data: leagueData } = await supabase
    .from('matches')
    .select('league')
    .not('video_url', 'is', null)
    .neq('video_url', '');

  const uniqueLeagues = Array.from(new Set((leagueData || []).map(m => m.league))).filter(Boolean).sort();
  const dynamicLeagues = ['All', ...uniqueLeagues];

  let query = supabase
    .from('matches')
    .select('*', { count: 'exact' })
    .not('video_url', 'is', null)
    .neq('video_url', '') 
    .order('match_date', { ascending: false });

  if (currentLeague !== 'All') {
      query = query.ilike('league', `%${currentLeague}%`);
  }

  query = query.range(from, to);

  const { data: highlights, count } = await query;
  const safeHighlights = highlights || [];
  const totalPages = count ? Math.ceil(count / ITEMS_PER_PAGE) : 1;

  const midIndex = Math.floor(safeHighlights.length / 2);
  const firstHalf = safeHighlights.slice(0, midIndex);
  const secondHalf = safeHighlights.slice(midIndex);

  const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Football Highlights & Goal Replays | FactSport',
      description: 'Watch the latest football highlights, goal replays, and match recaps from the top leagues worldwide.',
      url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://factsport.com'}/highlights`
  };

  return (
    <div className="min-h-screen bg-[#0a1428] text-white font-sans pb-16 overflow-x-hidden selection:bg-red-500">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      
      <div className="bg-[#0f1c3a] border-b border-white/10 sticky top-0 z-40 shadow-2xl backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Link href="/" className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full transition text-white active:scale-95">
                    <ArrowLeft size={18} />
                </Link>
                <h1 className="text-lg md:text-xl font-black uppercase tracking-tight flex items-center gap-2">
                    <Tv className="text-red-500" size={20} /> Video Hub
                </h1>
            </div>
            <div className="hidden sm:flex items-center gap-1 bg-green-500/20 text-green-400 px-2 py-1 rounded border border-green-500/30">
                <ShieldCheck size={12} />
                <span className="text-[9px] font-bold uppercase tracking-widest">Official Sync</span>
            </div>
        </div>
        
        {dynamicLeagues.length > 1 && (
            <div className="border-t border-white/5 mt-2 bg-[#0a1428]/50 overflow-x-auto scrollbar-hide">
                <div className="max-w-7xl mx-auto flex px-4 py-2.5 space-x-2 min-w-max">
                    {dynamicLeagues.map((league) => (
                        <Link 
                            key={league} 
                            href={`/highlights?league=${encodeURIComponent(league)}&page=1`} 
                            scroll={false}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${currentLeague === league ? 'bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.4)]' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                        >
                            {league === 'Premier League' ? 'EPL' : league}
                        </Link>
                    ))}
                </div>
            </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        
        <AdsterraStandardBanner />

        <div className="max-w-xl mx-auto mb-8 mt-4">
            <BettingPromo affiliateLink={null} />
        </div>

        {safeHighlights.length > 0 ? (
            <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                    {firstHalf.map((item) => (
                        <Link href={`/match/${item.id}`} key={item.id} className="group flex flex-col bg-slate-900 rounded-2xl shadow-xl border border-slate-800 overflow-hidden hover:shadow-2xl hover:border-blue-500/50 transition-all duration-500 hover:-translate-y-1">
                            <div className="relative aspect-video bg-black overflow-hidden border-b border-slate-800">
                                <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 to-slate-800 group-hover:scale-110 transition-transform duration-700 ease-out"></div>
                                <div className="absolute inset-0 flex items-center justify-center gap-6 opacity-90 group-hover:opacity-50 transition-opacity duration-500">
                                    <div className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center">
                                        {item.home_logo ? <img src={item.home_logo} alt={item.home_team} className="w-full h-full object-contain drop-shadow-2xl"/> : <span className="text-white text-xs font-bold">{item.home_team.substring(0,3)}</span>}
                                    </div>
                                    <span className="text-slate-600 font-black italic text-xl drop-shadow-lg">VS</span>
                                    <div className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center">
                                        {item.away_logo ? <img src={item.away_logo} alt={item.away_team} className="w-full h-full object-contain drop-shadow-2xl"/> : <span className="text-white text-xs font-bold">{item.away_team.substring(0,3)}</span>}
                                    </div>
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="bg-red-600/90 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(220,38,38,0.7)] transform scale-90 group-hover:scale-110 transition-all duration-300 backdrop-blur-sm">
                                        <PlayCircle className="text-white ml-1" size={28} />
                                    </div>
                                </div>
                                <div className="absolute top-3 left-3">
                                    <span className="bg-black/60 backdrop-blur-md text-white text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest border border-white/10 shadow-lg">{item.league}</span>
                                </div>
                                {(item.home_score !== null && item.away_score !== null) && (
                                    <div className="absolute top-3 right-3">
                                        <span className="bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-black px-2 py-1 rounded-md border border-white/10 shadow-lg tracking-widest">{item.home_score} - {item.away_score}</span>
                                    </div>
                                )}
                            </div>
                            <div className="p-4 md:p-5 flex flex-col flex-1 justify-between gap-4 bg-slate-900">
                                <h2 className="text-sm md:text-base font-black text-white leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">{item.home_team} vs {item.away_team}</h2>
                                <div className="flex items-center justify-between border-t border-slate-800 pt-3 mt-auto">
                                    <div className="flex items-center gap-1.5 text-slate-400"><Calendar size={12} /><span className="text-[10px] font-bold uppercase tracking-widest">{new Date(item.match_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
                                    <span className="text-[10px] font-black text-slate-300 group-hover:text-red-400 flex items-center gap-1 transition-colors uppercase tracking-widest">Play <PlayCircle size={10}/></span>
                                </div>
                            </div>
                        </Link>
                    ))}
                    
                    {safeHighlights.length > 0 && (
                        <div className="col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4 py-4">
                            <AdsterraStandardBanner />
                        </div>
                    )}

                    {secondHalf.map((item) => (
                        <Link href={`/match/${item.id}`} key={item.id} className="group flex flex-col bg-slate-900 rounded-2xl shadow-xl border border-slate-800 overflow-hidden hover:shadow-2xl hover:border-blue-500/50 transition-all duration-500 hover:-translate-y-1">
                             <div className="relative aspect-video bg-black overflow-hidden border-b border-slate-800">
                                <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 to-slate-800 group-hover:scale-110 transition-transform duration-700 ease-out"></div>
                                <div className="absolute inset-0 flex items-center justify-center gap-6 opacity-90 group-hover:opacity-50 transition-opacity duration-500">
                                    <div className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center">
                                        {item.home_logo ? <img src={item.home_logo} alt={item.home_team} className="w-full h-full object-contain drop-shadow-2xl"/> : <span className="text-white text-xs font-bold">{item.home_team.substring(0,3)}</span>}
                                    </div>
                                    <span className="text-slate-600 font-black italic text-xl drop-shadow-lg">VS</span>
                                    <div className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center">
                                        {item.away_logo ? <img src={item.away_logo} alt={item.away_team} className="w-full h-full object-contain drop-shadow-2xl"/> : <span className="text-white text-xs font-bold">{item.away_team.substring(0,3)}</span>}
                                    </div>
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="bg-red-600/90 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(220,38,38,0.7)] transform scale-90 group-hover:scale-110 transition-all duration-300 backdrop-blur-sm">
                                        <PlayCircle className="text-white ml-1" size={28} />
                                    </div>
                                </div>
                                <div className="absolute top-3 left-3">
                                    <span className="bg-black/60 backdrop-blur-md text-white text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest border border-white/10 shadow-lg">{item.league}</span>
                                </div>
                                {(item.home_score !== null && item.away_score !== null) && (
                                    <div className="absolute top-3 right-3">
                                        <span className="bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-black px-2 py-1 rounded-md border border-white/10 shadow-lg tracking-widest">{item.home_score} - {item.away_score}</span>
                                    </div>
                                )}
                            </div>
                            <div className="p-4 md:p-5 flex flex-col flex-1 justify-between gap-4 bg-slate-900">
                                <h2 className="text-sm md:text-base font-black text-white leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">{item.home_team} vs {item.away_team}</h2>
                                <div className="flex items-center justify-between border-t border-slate-800 pt-3 mt-auto">
                                    <div className="flex items-center gap-1.5 text-slate-400"><Calendar size={12} /><span className="text-[10px] font-bold uppercase tracking-widest">{new Date(item.match_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
                                    <span className="text-[10px] font-black text-slate-300 group-hover:text-red-400 flex items-center gap-1 transition-colors uppercase tracking-widest">Play <PlayCircle size={10}/></span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10 mt-8 shadow-sm">
                        <Link 
                            href={`/highlights?league=${encodeURIComponent(currentLeague)}&page=${currentPage - 1}`}
                            className={`px-4 py-2 flex items-center gap-2 rounded-xl text-xs font-black uppercase tracking-widest ${currentPage === 1 ? 'pointer-events-none opacity-30 bg-black/20 text-slate-500' : 'bg-blue-600 hover:bg-blue-500 text-white transition shadow-md'}`}
                        >
                            <ChevronLeft size={14}/> Prev
                        </Link>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Page {currentPage} of {totalPages}</span>
                        <Link 
                            href={`/highlights?league=${encodeURIComponent(currentLeague)}&page=${currentPage + 1}`}
                            className={`px-4 py-2 flex items-center gap-2 rounded-xl text-xs font-black uppercase tracking-widest ${currentPage === totalPages ? 'pointer-events-none opacity-30 bg-black/20 text-slate-500' : 'bg-blue-600 hover:bg-blue-500 text-white transition shadow-md'}`}
                        >
                            Next <ChevronRight size={14}/>
                        </Link>
                    </div>
                )}

                <AdsterraStandardBanner />

                <div className="mt-10 max-w-3xl mx-auto bg-[#0f1c3a] rounded-2xl p-4 md:p-5 border border-yellow-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500 opacity-10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(234,179,8,0.4)]">
                            <Trophy size={24} className="text-black fill-black" />
                        </div>
                        <div>
                            <h3 className="font-black text-lg uppercase italic text-white leading-tight tracking-tighter">Predict & <span className="text-yellow-500">Win Prizes</span></h3>
                            <p className="text-xs text-slate-400 font-bold mt-0.5">Join the leaderboard for fantastic rewards.</p>
                        </div>
                    </div>
                    <Link href="/vip/upgrade" className="relative z-10 w-full sm:w-auto shrink-0 bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition flex items-center justify-center gap-2 active:scale-95 shadow-md">
                        Play Now <ArrowRight size={14}/>
                    </Link>
                </div>
            </>
        ) : (
            <div className="flex flex-col items-center justify-center py-24 bg-white/5 rounded-3xl border border-white/10 border-dashed shadow-2xl mx-4 backdrop-blur-sm mt-6">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-5 border border-white/10 shadow-inner">
                    <Tv className="text-slate-500" size={40} />
                </div>
                <h3 className="text-xl font-black text-white mb-2">No Highlights Available</h3>
                <p className="text-xs text-slate-400 max-w-sm text-center leading-relaxed">
                    {currentLeague === 'All' 
                        ? "There are currently no match highlights to display. Check back after the next round of fixtures."
                        : `There are currently no highlights available for ${currentLeague}.`}
                </p>
                <Link href="/highlights?league=All&page=1" className="mt-8 bg-blue-600 text-white px-8 py-3 rounded-xl text-xs font-black hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] active:scale-95 flex items-center gap-2">
                    <ArrowLeft size={14} /> Clear Filters
                </Link>
            </div>
        )}
      </div>
    </div>
  );
}