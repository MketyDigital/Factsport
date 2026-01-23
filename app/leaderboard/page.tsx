export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import { Trophy, Medal, Star } from 'lucide-react';

export default async function LeaderboardPage() {
  const supabase = createClient();

  // Fetch Top 50 VIPs
  const { data: users } = await supabase
    .from('profiles')
    .select('full_name, monthly_points, monthly_correct_scores, is_vip')
    .eq('is_vip', true)
    .order('monthly_points', { ascending: false })
    .limit(50);

  // Logic to find Top 3
  const first = users?.find(u => u.monthly_correct_scores >= 2);
  const second = users?.find(u => u.monthly_correct_scores >= 2 && u !== first);
  const third = users?.find(u => u.monthly_correct_scores >= 1 && u !== first && u !== second);

  const renderCard = (user: any, rank: number, color: string) => (
    <div className={`p-4 rounded-xl border ${color} bg-white/5 text-center relative`}>
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black px-3 py-1 rounded-full border border-slate-700">
            RANK #{rank}
        </div>
        <h3 className="font-bold text-white mt-2">{user ? user.full_name : "Open Slot"}</h3>
        <div className="flex justify-center gap-2 mt-2 text-[10px] font-mono">
            <span className="bg-black/30 px-2 py-1 rounded text-yellow-400">{user?.monthly_points || 0} PTS</span>
            <span className="bg-black/30 px-2 py-1 rounded text-green-400">{user?.monthly_correct_scores || 0} CS</span>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a1428] pb-24 font-sans text-white p-4">
        <h1 className="text-2xl font-black italic text-center mb-8 flex items-center justify-center gap-2">
            <Trophy className="text-yellow-500" /> Monthly Kings
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {renderCard(first, 1, 'border-yellow-500/50')}
            {renderCard(second, 2, 'border-slate-400/50')}
            {renderCard(third, 3, 'border-orange-600/50')}
        </div>

        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <table className="w-full text-sm text-left">
                <thead className="text-[10px] uppercase text-slate-400 border-b border-white/10">
                    <tr><th className="p-3">User</th><th className="p-3">Points</th><th className="p-3">Correct Scores</th></tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {users?.map((u, i) => (
                        <tr key={i} className="hover:bg-white/5 transition">
                            <td className="p-3 font-bold">{u.full_name}</td>
                            <td className="p-3 font-mono text-yellow-400">{u.monthly_points}</td>
                            <td className="p-3 font-mono text-green-400">{u.monthly_correct_scores}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );
}