// ✅ RUNS ON EDGE
export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { 
  Trophy, TrendingUp, History, Star, User as UserIcon, 
  ExternalLink, Zap, Crown
} from 'lucide-react';
import SignOutButton from '@/app/components/SignOutButton';

async function getUserData() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // 1. Fetch Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, monthly_points, monthly_correct_scores')
    .eq('id', user.id)
    .single();

  // 2. Fetch Predictions (Correct Table & Relation)
  const { data: predictions } = await supabase
    .from('user_predictions')
    .select(`
        id, predicted_outcome, predicted_home_score, predicted_away_score, points_awarded, status, created_at,
        match:matches ( home_team, away_team )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  return { user, profile, predictions };
}

export default async function Dashboard() {
  const data = await getUserData();

  if (!data) redirect('/login');

  const { profile, predictions } = data;
   
  // VIP Logic
  const expiryDate = profile?.vip_expires_at ? new Date(profile.vip_expires_at) : null;
  const isVipActive = profile?.is_vip && (!expiryDate || expiryDate > new Date());

  return (
    <div className="min-h-screen bg-[#F0F2F5] pb-24 font-sans text-slate-900">
       
      {/* --- 1. HEADER SECTION --- */}
      <div className="bg-[#0a1428] text-white pt-8 pb-24 px-6 rounded-b-[2.5rem] relative overflow-hidden shadow-2xl">
        {/* Background Texture */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20"></div>
        
        <div className="relative z-10 flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/10 shadow-inner backdrop-blur-sm">
                    <UserIcon className="text-white" size={20} />
                </div>
                <div>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Welcome back</p>
                    <h1 className="text-xl font-black">{profile?.full_name || 'Champion'}</h1>
                </div>
            </div>
            <SignOutButton />
        </div>
      </div>

      {/* --- 2. STATS CARDS (Floating) --- */}
      <div className="grid grid-cols-2 gap-3 px-4 -mt-16 relative z-20 mb-4">
            {/* Monthly Progress */}
            <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-100 relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-16 h-16 bg-yellow-50 rounded-bl-full -mr-2 -mt-2 transition group-hover:bg-yellow-100"></div>
                <div className="relative z-10">
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                        <Star size={12} className="text-yellow-500 fill-yellow-500" /> Monthly Race
                    </div>
                    <div className="text-3xl font-black text-slate-900 tracking-tighter">{profile?.monthly_points || 0}</div>
                    <div className="text-[10px] text-slate-500 mt-1 font-medium">
                        Correct Scores: <b className="text-green-600 bg-green-50 px-1 rounded">{profile?.monthly_correct_scores || 0}</b>
                    </div>
                </div>
            </div>

            {/* Lifetime Points */}
            <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-100 relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-16 h-16 bg-blue-50 rounded-bl-full -mr-2 -mt-2 transition group-hover:bg-blue-100"></div>
                <div className="relative z-10">
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                        <History size={12} className="text-blue-500" /> All-Time
                    </div>
                    <div className="text-3xl font-black text-slate-900 tracking-tighter">{profile?.points || 0}</div>
                    <div className="text-[10px] text-slate-400 mt-1">Total Points Earned</div>
                </div>
            </div>
      </div>

      {/* --- 3. VIP STATUS CARD (The Upsell) --- */}
      <div className="px-4 mb-6">
        <Link href={isVipActive ? "/leaderboard" : "/vip/upgrade"}>
            <div className={`p-5 rounded-2xl border relative overflow-hidden transition active:scale-95 shadow-lg ${isVipActive ? 'bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
                
                {/* Visual Flair */}
                {isVipActive ? (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500 rounded-full blur-[60px] opacity-10"></div>
                ) : (
                    <div className="absolute top-0 right-0 w-20 h-20 bg-red-500 rounded-full blur-[40px] opacity-5"></div>
                )}

                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Crown size={16} className={isVipActive ? "text-yellow-400 fill-yellow-400" : "text-slate-400"} />
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Membership Status</span>
                        </div>
                        {isVipActive ? (
                            <div>
                                <div className="text-xl font-black uppercase tracking-wide text-white">VIP Active</div>
                                <div className="text-[10px] mt-1 text-slate-400">{expiryDate ? `Expires ${expiryDate.toLocaleDateString()}` : 'Lifetime Access'}</div>
                            </div>
                        ) : (
                            <div>
                                <div className="text-xl font-black uppercase tracking-wide text-slate-800">Free Plan</div>
                                <div className="text-[10px] mt-1 text-slate-500">Upgrade to see Expert Tips</div>
                            </div>
                        )}
                    </div>

                    {/* Action Button inside Card */}
                    {isVipActive ? (
                        <div className="bg-white/10 p-2 rounded-full border border-white/10">
                            <Trophy size={20} className="text-yellow-400" />
                        </div>
                    ) : (
                        <div className="bg-red-600 text-white text-[10px] font-black px-4 py-2 rounded-xl shadow-lg shadow-red-200 animate-pulse">
                            UPGRADE
                        </div>
                    )}
                </div>
            </div>
        </Link>
      </div>

      {/* --- 4. PREDICTION HISTORY --- */}
      <div className="px-4">
          <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <TrendingUp size={14} /> Recent Activity
              </h3>
              <Link href="/leaderboard" className="text-[10px] font-bold text-blue-600 flex items-center gap-1">
                  View Leaderboard <ExternalLink size={10} />
              </Link>
          </div>
           
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[200px]">
             {predictions && predictions.length > 0 ? (
                 predictions.map((pred: any) => (
                     <div key={pred.id} className="p-4 border-b border-slate-50 last:border-0 flex justify-between items-center hover:bg-slate-50 transition">
                        <div>
                            {/* Match Name */}
                            <div className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                                {pred.match ? (
                                    <>
                                      {pred.match.home_team} <span className="text-slate-300 text-[10px]">vs</span> {pred.match.away_team}
                                    </>
                                ) : (
                                    <span className="text-slate-400 italic">Match Data Unavailable</span>
                                )}
                            </div>
                            
                            {/* User's Prediction */}
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase border border-slate-200">
                                    {pred.predicted_outcome}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono font-bold">
                                    {pred.predicted_home_score} - {pred.predicted_away_score}
                                </span>
                            </div>
                        </div>
                        
                        {/* Status / Points */}
                        <div className="text-right">
                            {/* ✅ SAFE CHECK: Converts to lowercase to prevent 'LOST' bug */}
                            {pred.status?.toLowerCase() === 'pending' ? (
                                <div className="flex flex-col items-end">
                                    <span className="text-[9px] font-black text-yellow-600 bg-yellow-50 px-2 py-1 rounded border border-yellow-100">PENDING</span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-end">
                                    <span className={`text-[9px] font-black px-2 py-1 rounded border ${pred.points_awarded > 0 ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                        {pred.points_awarded > 0 ? `+${pred.points_awarded} PTS` : 'LOST'}
                                    </span>
                                </div>
                            )}
                            <div className="text-[9px] text-slate-300 mt-1 font-medium">
                                {new Date(pred.created_at).toLocaleDateString()}
                            </div>
                        </div>
                     </div>
                 ))
             ) : (
                 <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3 text-slate-300">
                        <Zap size={24} />
                    </div>
                    <p className="text-xs font-bold text-slate-600">No predictions yet</p>
                    <p className="text-[10px] text-slate-400 mb-4 max-w-[200px]">Start predicting matches to earn points and climb the leaderboard.</p>
                    <Link href="/" className="text-xs font-black bg-slate-900 text-white px-5 py-2.5 rounded-xl shadow-lg active:scale-95 transition">
                        Predict Matches
                    </Link>
                 </div>
             )}
          </div>
      </div>

    </div>
  );
}