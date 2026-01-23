export const runtime = 'edge';
export const dynamic = 'force-dynamic'; // Ensure we always see fresh data

import { createClient } from '@/app/lib/supabase/server';
import Link from "next/link";
import { Zap, Trophy, TrendingUp, ChevronRight, Activity, Calendar } from "lucide-react";

async function getMatches() {
  const supabase = createClient();
  
  // Fetch matches sorted by time
  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .order('match_date', { ascending: true })
    .limit(50); // Get next 50 games

  return matches || [];
}

export default async function Home() {
  const allMatches = await getMatches();

  // Filter for specific sections
  const liveMatches = allMatches.filter(m => m.status === 'LIVE');
  const upcomingMatches = allMatches.filter(m => m.status !== 'LIVE' && m.status !== 'FINISHED');
  
  // Pick a Featured Match (First Live match, or first upcoming)
  const featured = liveMatches.length > 0 ? liveMatches[0] : upcomingMatches[0];

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans pb-20">
      
      {/* --- 1. NAVBAR --- */}
      <nav className="sticky top-0 z-50 bg-[#0a1428] text-white border-b border-white/10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="relative flex items-center justify-center w-10 h-10">
               <div className="absolute w-full h-full bg-gradient-to-r from-red-600 to-blue-800 clip-hexagon"></div>
               <div className="absolute w-[80%] h-[80%] bg-blue-900 clip-hexagon"></div>
               <span className="relative font-bold italic text-white text-xs">FS</span>
            </div>
            <span className="text-2xl font-black tracking-tighter text-white">
              Fact<span className="text-gray-300">Sport</span>
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <Link href="/login" className="px-4 py-1.5 text-xs font-bold text-white/80 hover:text-white border border-white/20 rounded-full transition">
              Login
            </Link>
            <Link href="/vip/upgrade" className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.5)] transition flex items-center gap-1">
              <Trophy size={12} /> VIP
            </Link>
          </div>
        </div>
      </nav>

      {/* --- 2. BREAKING NEWS --- */}
      <div className="bg-red-700 text-white text-[10px] font-bold py-2 overflow-hidden relative flex items-center shadow-md z-40">
        <div className="absolute left-0 h-full bg-red-800 px-3 flex items-center z-10 shadow-r-xl">
          <Activity size={12} className="mr-1 animate-pulse" /> BREAKING
        </div>
        <div className="whitespace-nowrap animate-marquee pl-32 flex space-x-8">
          <span>🚨 MAN CITY AGREE DEAL FOR NEW STRIKER</span>
          <span>• OSIMHEN TRANSFER SAGA CONTINUES</span>
          <span>• REAL MADRID INJURY CRISIS</span>
        </div>
      </div>

      {/* --- 3. HERO SECTION (Featured Match) --- */}
      {featured && (
        <header className="relative bg-[#0a1428] pb-12 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-600 rounded-full blur-[100px] opacity-10"></div>

          <div className="relative max-w-7xl mx-auto px-4 pt-6">
            <h1 className="text-white text-lg font-black uppercase italic tracking-tighter mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-red-600 block"></span>
              {featured.status === 'LIVE' ? 'Live Now' : 'Up Next'}
            </h1>
            
            <Link href={`/match/${featured.id}`}>
              <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 text-white shadow-2xl relative overflow-hidden active:scale-95 transition-transform">
                
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 mb-6">
                  <span className="bg-white/10 px-2 py-1 rounded tracking-wider">{featured.league}</span>
                  {featured.status === 'LIVE' ? (
                     <span className="text-red-500 flex items-center gap-1 animate-pulse">
                       <span className="w-2 h-2 bg-red-500 rounded-full"></span> LIVE
                     </span>
                  ) : (
                     <span className="flex items-center gap-1">
                        <Calendar size={10} /> {new Date(featured.match_date).toLocaleDateString()}
                     </span>
                  )}
                </div>

                <div className="flex justify-between items-center mb-8 px-2">
                  <div className="flex flex-col items-center gap-2 w-1/3 text-center">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-900 font-black text-xs shadow-lg">
                      {featured.home_team.substring(0, 3).toUpperCase()}
                    </div>
                    <div className="font-bold text-sm leading-tight">{featured.home_team}</div>
                  </div>

                  <div className="flex flex-col items-center justify-center w-1/3">
                    <div className="text-3xl font-black tracking-widest leading-none bg-black/30 px-3 py-1 rounded-lg">
                      {featured.status === 'SCHEDULED' ? 'VS' : `${featured.home_score}:${featured.away_score}`}
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-2 w-1/3 text-center">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-900 font-black text-xs shadow-lg">
                      {featured.away_team.substring(0, 3).toUpperCase()}
                    </div>
                    <div className="font-bold text-sm leading-tight">{featured.away_team}</div>
                  </div>
                </div>

                <div className="w-full bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-black uppercase text-xs shadow-lg flex items-center justify-center gap-2 transition-colors">
                  <Zap size={14} /> Predict & Win
                </div>
              </div>
            </Link>
          </div>
        </header>
      )}

      {/* --- 4. MATCH LIST --- */}
      <main className="max-w-7xl mx-auto px-4 py-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">All Matches</h3>
        
        {upcomingMatches.length === 0 && liveMatches.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">
                No matches synced yet.<br/>
                <span className="text-xs opacity-50">Run /api/sync to load data.</span>
            </div>
        )}

        {/* Live Matches First */}
        {liveMatches.map((match) => (
           <MatchCard key={match.id} match={match} isLive={true} />
        ))}

        {/* Upcoming Matches */}
        {upcomingMatches.map((match) => (
           <MatchCard key={match.id} match={match} isLive={false} />
        ))}
      </main>

    </div>
  );
}

// Helper Component for List Items
function MatchCard({ match, isLive }: { match: any, isLive: boolean }) {
    return (
        <Link href={`/match/${match.id}`}>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center justify-between active:bg-slate-50 transition">
                <div className="flex items-center space-x-4">
                    <div className="flex flex-col items-center justify-center w-12 border-r border-slate-100 pr-4">
                        <span className={`text-xs font-black ${isLive ? 'text-red-600' : 'text-slate-800'}`}>
                            {isLive ? 'LIVE' : new Date(match.match_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {!isLive && <span className="text-[10px] text-slate-400 font-bold">Today</span>}
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            {isLive && <span className="text-xs font-bold text-slate-900">{match.home_score}</span>}
                            <span className="text-sm font-bold text-slate-700 truncate w-32">{match.home_team}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {isLive && <span className="text-xs font-bold text-slate-900">{match.away_score}</span>}
                            <span className="text-sm font-bold text-slate-700 truncate w-32">{match.away_team}</span>
                        </div>
                    </div>
                </div>
                <ChevronRight className="text-slate-300" size={18} />
            </div>
        </Link>
    );
}