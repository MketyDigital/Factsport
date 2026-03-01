// ✅ RUNS ON EDGE
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import { Trophy, Star, Crown, History, TrendingUp, Calendar, Send, ExternalLink, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default async function LeaderboardPage() {
  const supabase = createClient();

  const { data: settings } = await supabase
    .from('site_settings')
    .select('target_exact_scores, min_points_floor')
    .limit(1)
    .single();

  const targetCS = settings?.target_exact_scores || 4;
  const floorPts = settings?.min_points_floor || 100;

  const { data: users } = await supabase
    .from('profiles')
    .select('full_name, monthly_points, points, monthly_correct_scores, eligible_monthly_points, eligible_monthly_correct_scores, is_vip')
    .order('monthly_points', { ascending: false })
    .order('monthly_correct_scores', { ascending: false })
    .limit(50);

  // STRICT PODIUM LOGIC
  const podiumQualifiers = users?.filter(u => 
      u.is_vip && 
      u.eligible_monthly_correct_scores >= targetCS && 
      u.eligible_monthly_points >= floorPts
  ).sort((a, b) => b.eligible_monthly_points - a.eligible_monthly_points) || [];
  
  const first = podiumQualifiers[0];
  const second = podiumQualifiers[1];
  const third = podiumQualifiers[2];

  // (Optional: You can fetch real approved past winners from the 'monthly_winners' table here later!)
  const pastWinners = [
    { month: 'December 2025', name: 'Sarah J.', points: 145, prize: '$500' },
    { month: 'November 2025', name: 'Mike T.', points: 132, prize: '$300' },
    { month: 'October 2025', name: 'David B.', points: 128, prize: '$200' },
  ];

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
                <div className="mb-3 bg-slate-900 text-white text-[10px] font-black px-3 py-1 rounded-full border border-slate-700 z-10 shadow-lg">#{rank}</div>
                {isUnclaimed ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-50 mt-4 text-center">
                        <Trophy size={24} className="text-slate-500 mb-2" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unclaimed</span>
                        <span className="text-[8px] text-slate-500 mt-1 max-w-[100px] leading-tight">Need VIP + {targetCS} CS + {floorPts} Pts</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full z-10">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/20 flex items-center justify-center text-xl shadow-lg mb-2">{user.full_name.charAt(0)}</div>
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
        <div className="text-center mb-6 pt-4">
            <h1 className="text-3xl font-black italic flex items-center justify-center gap-2 mb-2">
                <Trophy className="text-yellow-500 fill-yellow-500" /> Monthly Kings
            </h1>
            <p className="text-xs text-slate-400 uppercase tracking-widest">
                Race ends in {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()} days
            </p>
        </div>

        <div className="flex items-end justify-center gap-2 mb-4 max-w-lg mx-auto h-[320px]">
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

        <div className="grid grid-cols-2 gap-3 mb-8">
            <a href={TELEGRAM_LINK} target="_blank" className="bg-[#229ED9]/10 border border-[#229ED9]/30 hover:bg-[#229ED9]/20 text-[#229ED9] p-3 rounded-xl flex items-center justify-center gap-2 transition">
                <Send size={16} /> <span className="text-xs font-bold">Join Community</span>
            </a>
            <a href={BETTING_LINK} target="_blank" className="bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 text-yellow-500 p-3 rounded-xl flex items-center justify-center gap-2 transition">
                <ExternalLink size={16} /> <span className="text-xs font-bold">Bet on Melbet</span>
            </a>
        </div>

        <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden mb-12 shadow-2xl">
            <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center gap-2"><TrendingUp size={16} /> Live Standings</h3>
                <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-slate-300">Total Points</span>
            </div>
            <table className="w-full text-sm text-left">
                <thead className="text-[9px] uppercase text-slate-400 bg-black/20">
                    <tr>
                        <th className="p-3 pl-4">Rank</th>
                        <th className="p-3">User</th>
                        <th className="p-3 text-center">Total Pts</th>
                        <th className="p-3 text-center">Overall</th>
                        <th className="p-3 text-right pr-4">Total CS</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {users?.map((u, i) => (
                        <tr key={i} className={`transition group ${u.is_vip ? 'hover:bg-yellow-500/5' : 'hover:bg-white/5'}`}>
                            <td className="p-3 pl-4 font-mono text-slate-500 text-xs font-bold">{i + 1}</td>
                            <td className="p-3 font-bold">
                                <div className="flex items-center gap-2">
                                    <span className={u.is_vip ? "text-white" : "text-slate-300"}>{u.full_name}</span>
                                    {u.is_vip && <Star size={10} className="text-yellow-400 fill-yellow-400 animate-pulse" />}
                                </div>
                            </td>
                            <td className="p-3 text-center"><span className="bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded font-mono font-bold text-xs border border-yellow-500/20">{u.monthly_points}</span></td>
                            <td className="p-3 text-center font-mono text-slate-400 text-xs">{u.points}</td>
                            <td className="p-3 pr-4 text-right"><span className="font-mono font-bold text-xs text-slate-300">{u.monthly_correct_scores}</span></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        <div>
             <h3 className="text-sm font-black uppercase text-slate-500 mb-4 flex items-center gap-2 pl-2"><History size={16} /> Hall of Fame</h3>
             <div className="grid gap-3">
                {pastWinners.map((winner, i) => (
                    <div key={i} className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 rounded-xl border border-slate-700 flex items-center justify-between relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-full bg-white/5 -skew-x-12 translate-x-12 group-hover:translate-x-0 transition duration-700"></div>
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30 text-yellow-500"><Trophy size={18} /></div>
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5 flex items-center gap-1"><Calendar size={10} /> {winner.month}</p>
                                <p className="font-bold text-white text-sm">{winner.name}</p>
                            </div>
                        </div>
                        <div className="text-right relative z-10">
                            <div className="text-xl font-black text-yellow-400 italic">{winner.points} pts</div>
                            <div className="text-[9px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full inline-block mt-1 border border-green-500/20">Won {winner.prize}</div>
                        </div>
                    </div>
                ))}
             </div>
        </div>
    </div>
  );
}