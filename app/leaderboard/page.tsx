export const runtime = 'edge';
export const revalidate = 15;

import { createClient } from '@supabase/supabase-js'; 
import { Trophy, Star, Crown, History, TrendingUp, Calendar, Send, ExternalLink, ArrowRight, Zap, Target } from 'lucide-react';
import Link from 'next/link';
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';

export const metadata = {
  title: 'Prediction Leaderboard & Winners | FactSport',
  description: 'View the global VIP prediction leaderboard. See who is winning monthly cash prizes by predicting football matches and scores.',
};

export default async function LeaderboardPage() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  // 🟢 SUPABASE FREE TIER MANEUVER: PARALLEL EXECUTION
  // Bundling these 5 queries drops load time from ~1000ms to ~150ms and saves DB connections.
  const [
      { data: settings },
      { data: users },
      { data: activeCampaigns },
      { data: approvedWinners },
      { data: pastCampaigns }
  ] = await Promise.all([
      supabase.from('site_settings').select('target_exact_scores, min_points_floor').limit(1).single(),
      
      supabase
        .from('profiles')
        .select('full_name, monthly_points, points, monthly_correct_scores, eligible_monthly_points, eligible_monthly_correct_scores, is_vip')
        .gt('monthly_points', 0) 
        .order('monthly_points', { ascending: false })
        .order('monthly_correct_scores', { ascending: false })
        .limit(100),
        
      supabase
        .from('campaigns')
        .select(`id, title, end_date, is_vip_required, rules, leaderboard:campaign_leaderboards(total_points, user:profiles(full_name, is_vip))`)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
        
      supabase
        .from('monthly_winners')
        .select('month_year, points, prize_amount, rank, created_at, user:profiles(full_name)')
        .eq('is_approved', true)
        .order('created_at', { ascending: false }),
        
      supabase
        .from('campaigns')
        .select(`title, end_date, rules, leaderboard:campaign_leaderboards(total_points, user:profiles(full_name))`)
        .eq('is_active', false)
        .order('end_date', { ascending: false })
  ]);

  const targetCS = settings?.target_exact_scores || 4;
  const floorPts = settings?.min_points_floor || 100;

  const podiumQualifiers = users?.filter(u => u.is_vip && u.eligible_monthly_correct_scores >= targetCS && u.eligible_monthly_points >= floorPts)
      .sort((a, b) => b.eligible_monthly_points - a.eligible_monthly_points) || [];
      
  const first = podiumQualifiers[0]; 
  const second = podiumQualifiers[1]; 
  const third = podiumQualifiers[2];

  // Combine and Sort the Hall of Fame
  let allPastWinners: any[] = [];

  if (approvedWinners) {
      approvedWinners.forEach(w => {
        let winnerName = 'Champion';
        if (w.user) winnerName = Array.isArray(w.user) ? w.user[0]?.full_name : (w.user as any).full_name;
        allPastWinners.push({ 
            title: w.month_year, 
            name: winnerName, 
            points: w.points, 
            prize: w.prize_amount || 'Monthly Prize', 
            isCampaign: false,
            date: new Date(w.created_at).getTime()
        });
      });
  }

  if (pastCampaigns) {
      pastCampaigns.forEach(camp => {
          if (camp.leaderboard && camp.leaderboard.length > 0) {
              const topPlayer = camp.leaderboard.sort((a:any, b:any) => b.total_points - a.total_points)[0];
              if (topPlayer.user) {
                  const championName = Array.isArray(topPlayer.user) 
                      ? topPlayer.user[0]?.full_name 
                      : (topPlayer.user as any).full_name;

                  allPastWinners.push({
                      title: camp.title,
                      name: championName || 'Champion',
                      points: topPlayer.total_points,
                      prize: camp.rules?.prize || 'Tournament Champion', 
                      isCampaign: true,
                      date: new Date(camp.end_date).getTime()
                  });
              }
          }
      });
  }

  allPastWinners.sort((a, b) => b.date - a.date);

  const TELEGRAM_LINK = "https://t.me/factsportlive"; 
  const BETTING_LINK = "https://melbet.com";

  const renderPodiumCard = (user: any, rank: number, color: string, heightClass: string) => {
    const isUnclaimed = !user;
    return (
        <div className={`relative flex flex-col items-center justify-end ${heightClass} w-full`}>
            {rank === 1 && !isUnclaimed && (
                <div className="absolute -top-6 animate-bounce">
                    <Crown size={32} className="text-yellow-400 fill-yellow-400 drop-shadow-lg" />
                </div>
            )}
            <div className={`w-full h-full rounded-t-2xl border-x border-t ${color} bg-gradient-to-b from-white/10 to-transparent backdrop-blur-sm p-4 flex flex-col items-center justify-start relative overflow-hidden`}>
                {!isUnclaimed && <div className={`absolute top-0 inset-x-0 h-24 bg-${rank === 1 ? 'yellow' : rank === 2 ? 'slate' : 'orange'}-500/20 blur-xl`}></div>}
                
                <div className="mb-3 bg-slate-900 text-white text-[10px] font-black px-3 py-1 rounded-full border border-slate-700 z-10 shadow-lg">
                    #{rank}
                </div>
                
                {isUnclaimed ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-50 mt-4 text-center">
                        <Trophy size={24} className="text-slate-500 mb-2" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unclaimed</span>
                        <span className="text-[8px] text-slate-500 mt-1 max-w-[100px] leading-tight">Need VIP + {targetCS} CS + {floorPts} Pts</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full z-10">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/20 flex items-center justify-center text-xl shadow-lg mb-2">
                            {user.full_name.charAt(0)}
                        </div>
                        <h3 className="font-bold text-white text-sm line-clamp-1 text-center">{user.full_name}</h3>
                        
                        <div className="mt-2 flex flex-col gap-1 w-full px-2">
                             <div className="bg-slate-900/50 rounded flex justify-between px-2 py-1 border border-white/5">
                                 <span className="text-[9px] text-slate-400">ELIGIBLE PTS</span>
                                 <span className="text-[9px] font-bold text-yellow-400">{user.eligible_monthly_points}</span>
                             </div>
                             <div className="bg-slate-900/50 rounded flex justify-between px-2 py-1 border border-white/5">
                                 <span className="text-[9px] text-slate-400">ELIGIBLE CS</span>
                                 <span className="text-[9px] font-bold text-green-400">{user.eligible_monthly_correct_scores}</span>
                             </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a1428] pb-24 font-sans text-white p-4">
        
        <div className="text-center mb-4 pt-4">
            <h1 className="text-3xl font-black italic flex items-center justify-center gap-2 mb-2">
                <Trophy className="text-yellow-500 fill-yellow-500" /> Monthly Kings
            </h1>
            <p className="text-xs text-slate-400 uppercase tracking-widest">
                Race ends in {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()} days
            </p>
        </div>

        <AdsterraStandardBanner />

        <div className="flex items-end justify-center gap-2 mt-6 mb-4 max-w-lg mx-auto h-[320px]">
            <div className="w-1/3 flex justify-center">{renderPodiumCard(second, 2, 'border-slate-400/30 shadow-[0_-5px_20px_rgba(148,163,184,0.1)]', 'h-[240px]')}</div>
            <div className="w-1/3 flex justify-center z-10">{renderPodiumCard(first, 1, 'border-yellow-500/50 shadow-[0_-5px_30px_rgba(234,179,8,0.2)]', 'h-[300px]')}</div>
            <div className="w-1/3 flex justify-center">{renderPodiumCard(third, 3, 'border-orange-600/30 shadow-[0_-5px_20px_rgba(234,88,12,0.1)]', 'h-[220px]')}</div>
        </div>

        <div className="text-center mt-4 mb-8">
            <Link href="/how-to-play" className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1">
                Read the Champion's Audit rules to see how winners are verified <ArrowRight size={12} />
            </Link>
        </div>

        <div className="bg-gradient-to-r from-blue-900/40 to-slate-900/40 border border-blue-500/20 rounded-xl p-3 mb-6 text-center backdrop-blur-md">
            <p className="text-[10px] text-blue-200 font-medium">
                🏆 <span className="font-bold text-white">To Win:</span> You must be <span className="text-yellow-400 font-bold">VIP</span>, score <span className="text-white font-bold">{floorPts}+ Elig. Pts</span>, and hit <span className="text-green-400 font-bold">{targetCS}+ Elig. CS</span>.
            </p>
        </div>

        <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden mb-12 shadow-2xl">
            <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center gap-2"><TrendingUp size={16} /> Live Standings (Top 100)</h3>
                <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-slate-300">Total Points</span>
            </div>
            
            {(!users || users.length === 0) ? (
                <div className="p-8 text-center text-xs font-bold text-slate-400">
                    No active predictions yet. Be the first to score!
                </div>
            ) : (
                <div className="max-h-[400px] overflow-y-auto relative styled-scrollbar">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[9px] uppercase text-slate-400 bg-[#0f192e] sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th className="p-3 pl-4">Rank</th>
                                <th className="p-3">User</th>
                                <th className="p-3 text-center">Total Pts</th>
                                <th className="p-3 text-center">Overall</th>
                                <th className="p-3 text-right pr-4">Total CS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {users.map((u, i) => (
                                <tr key={i} className={`transition group ${u.is_vip ? 'hover:bg-yellow-500/5' : 'hover:bg-white/5'}`}>
                                    <td className="p-3 pl-4 font-mono text-slate-500 text-xs font-bold">{i + 1}</td>
                                    <td className="p-3 font-bold">
                                        <div className="flex items-center gap-2">
                                            <span className={u.is_vip ? "text-white" : "text-slate-300"}>{u.full_name}</span>
                                            {u.is_vip && <Star size={10} className="text-yellow-400 fill-yellow-400 animate-pulse" />}
                                        </div>
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className="bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded font-mono font-bold text-xs border border-yellow-500/20">{u.monthly_points}</span>
                                    </td>
                                    <td className="p-3 text-center font-mono text-slate-400 text-xs">{u.points}</td>
                                    <td className="p-3 pr-4 text-right">
                                        <span className="font-mono font-bold text-xs text-slate-300">{u.monthly_correct_scores}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>

        {activeCampaigns && activeCampaigns.length > 0 && (
            <div className="mb-12">
                <h3 className="text-xl font-black italic flex items-center justify-center gap-2 mb-6 uppercase tracking-widest text-orange-500">
                    <Zap size={24} className="text-orange-500 fill-orange-500" /> Active Tournaments
                </h3>
                
                <div className="grid gap-6">
                    {activeCampaigns.map(camp => {
                        const sortedLeaders = camp.leaderboard
                            ?.filter((l: any) => l.total_points > 0)
                            .sort((a:any, b:any) => b.total_points - a.total_points)
                            .slice(0, 100) || [];
                            
                        const campFloor = camp.rules?.min_points_floor || 50;
                        
                        return (
                            <div key={camp.id} className="bg-gradient-to-br from-orange-900/40 to-slate-900/40 border border-orange-500/20 rounded-3xl overflow-hidden shadow-2xl">
                                <div className="p-4 border-b border-orange-500/20 bg-orange-500/10 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-black text-sm text-white uppercase tracking-wider flex items-center gap-2">
                                            {camp.title}
                                            {!camp.is_vip_required && <span className="bg-green-500 text-[8px] px-1.5 py-0.5 rounded shadow">FREE PLAY</span>}
                                        </h3>
                                        <p className="text-[9px] font-bold text-orange-400 uppercase tracking-widest flex items-center gap-1 mt-1">
                                            <Target size={10}/> TO WIN: {campFloor}+ PTS
                                        </p>
                                    </div>
                                    <Trophy size={20} className="text-orange-400" />
                                </div>
                                
                                {sortedLeaders.length === 0 ? (
                                    <div className="p-6 text-center text-xs font-bold text-slate-400">No points awarded yet.</div>
                                ) : (
                                    <div className="max-h-[350px] overflow-y-auto relative styled-scrollbar">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-[9px] uppercase text-orange-200/50 bg-[#1a0f00] sticky top-0 z-20 shadow-sm border-b border-orange-500/20">
                                                <tr>
                                                    <th className="p-3 pl-4 w-12">Rank</th>
                                                    <th className="p-3">Champion</th>
                                                    <th className="p-3 text-right pr-4">Points</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {sortedLeaders.map((ldr:any, i:number) => {
                                                    const isQualified = ldr.total_points >= campFloor && (!camp.is_vip_required || ldr.user?.is_vip);
                                                    return (
                                                    <tr key={i} className="hover:bg-white/5 transition">
                                                        <td className="p-3 pl-4 font-mono text-orange-400 text-xs font-black">{i + 1}</td>
                                                        <td className="p-3 font-bold text-slate-200 flex items-center gap-2">
                                                            {ldr.user?.full_name} 
                                                            {ldr.user?.is_vip && <Star size={10} className="text-yellow-400 fill-yellow-400" />} 
                                                            {isQualified && <span className="bg-green-500 text-white text-[7px] px-1.5 py-0.5 rounded ml-2">QUALIFIED</span>}
                                                        </td>
                                                        <td className="p-3 text-right pr-4 font-mono font-black text-white">{ldr.total_points}</td>
                                                    </tr>
                                                )})}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-8">
            <a href={TELEGRAM_LINK} target="_blank" className="bg-[#229ED9]/10 border border-[#229ED9]/30 hover:bg-[#229ED9]/20 text-[#229ED9] p-3 rounded-xl flex items-center justify-center gap-2 transition">
                <Send size={16} /> <span className="text-xs font-bold">Join Community</span>
            </a>
            <a href={BETTING_LINK} target="_blank" className="bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 text-yellow-500 p-3 rounded-xl flex items-center justify-center gap-2 transition">
                <ExternalLink size={16} /> <span className="text-xs font-bold">Visit Melbet (Partner)</span>
            </a>
        </div>

        <div>
             <h3 className="text-sm font-black uppercase text-slate-500 mb-4 flex items-center gap-2 pl-2"><History size={16} /> Hall of Fame</h3>
             <div className="grid gap-3">
                {allPastWinners.length === 0 ? (
                    <div className="text-center text-slate-500 text-xs py-8">No winners approved yet. Be the first!</div>
                ) : (
                    allPastWinners.map((winner, i) => (
                        <div key={i} className={`p-4 rounded-xl border flex items-center justify-between relative overflow-hidden group ${winner.isCampaign ? 'bg-gradient-to-r from-orange-900/40 to-[#0a1428] border-orange-500/30' : 'bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700'}`}>
                            <div className="absolute top-0 right-0 w-24 h-full bg-white/5 -skew-x-12 translate-x-12 group-hover:translate-x-0 transition duration-700"></div>
                            <div className="flex items-center gap-4 relative z-10">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${winner.isCampaign ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' : 'bg-yellow-500/20 border-yellow-500/30 text-yellow-500'}`}>
                                    {winner.isCampaign ? <Zap size={18} /> : <Trophy size={18} />}
                                </div>
                                <div>
                                    <p className={`text-[10px] uppercase font-bold tracking-wider mb-0.5 flex items-center gap-1 ${winner.isCampaign ? 'text-orange-300' : 'text-slate-400'}`}>
                                        <Calendar size={10} /> {winner.title}
                                    </p>
                                    <p className="font-bold text-white text-sm">{winner.name}</p>
                                </div>
                            </div>
                            <div className="text-right relative z-10">
                                <div className={`text-xl font-black italic ${winner.isCampaign ? 'text-orange-400' : 'text-yellow-400'}`}>{winner.points} pts</div>
                                <div className={`text-[9px] px-2 py-0.5 rounded-full inline-block mt-1 border ${winner.isCampaign ? 'bg-orange-500/20 text-orange-300 border-orange-500/20' : 'bg-green-500/20 text-green-400 border-green-500/20'}`}>
                                    Won {winner.prize}
                                </div>
                            </div>
                        </div>
                    ))
                )}
             </div>
        </div>

        <div className="mt-8">
            <AdsterraStandardBanner />
        </div>
    </div>
  );
}