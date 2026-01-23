// ✅ RUNS ON EDGE
export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { 
  Trophy, TrendingUp, History, Star, User as UserIcon, 
  AlertCircle, Ticket, Youtube, Facebook, Gift, ExternalLink 
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

  // 2. Fetch Predictions (FIXED QUERY)
  // We explicitly select the match details using the foreign key relationship
  const { data: predictions, error } = await supabase
    .from('user_predictions')
    .select(`
        id,
        predicted_outcome,
        predicted_home_score,
        predicted_away_score,
        points_awarded,
        status,
        created_at,
        match:matches (
            home_team,
            away_team
        )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
      console.error("Dashboard Prediction Error:", error);
  }

  return { user, profile, predictions };
}

export default async function Dashboard() {
  const data = await getUserData();

  if (!data) {
    redirect('/login');
  }

  const { profile, predictions } = data;

  const expiryDate = profile?.vip_expires_at ? new Date(profile.vip_expires_at) : null;
  const isVipActive = profile?.is_vip && (!expiryDate || expiryDate > new Date());

  return (
    <div className="min-h-screen bg-[#F0F2F5] pb-24 font-sans text-slate-900">
      
      {/* --- HEADER --- */}
      <div className="bg-[#0a1428] text-white pt-8 pb-20 px-6 rounded-b-[2.5rem] relative overflow-hidden shadow-2xl">
        <div className="relative z-10 flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/10 shadow-inner">
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

      {/* --- STATS CARDS --- */}
      <div className="grid grid-cols-2 gap-3 px-4 -mt-16 relative z-20">
            {/* MONTHLY CARD */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                    <Star size={12} className="text-yellow-500" /> Monthly
                </div>
                <div className="text-2xl font-black text-slate-800">{profile?.monthly_points || 0}</div>
                <div className="text-[10px] text-slate-500 mt-1">CS Wins: <b className="text-green-600">{profile?.monthly_correct_scores || 0}</b></div>
            </div>

            {/* LIFETIME CARD */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                 <div className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                    <History size={12} className="text-blue-500" /> Lifetime
                </div>
                <div className="text-2xl font-black text-slate-800">{profile?.points || 0}</div>
            </div>
      </div>

      {/* --- PREDICTION HISTORY LIST --- */}
      <div className="px-4 mt-6">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
             <TrendingUp size={14} /> Recent Predictions
          </h3>
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
             {predictions && predictions.length > 0 ? (
                 predictions.map((pred: any) => (
                     <div key={pred.id} className="p-4 border-b border-slate-50 last:border-0 flex justify-between items-center hover:bg-slate-50 transition">
                        <div>
                            {/* Match Name */}
                            <div className="text-xs font-bold text-slate-800 mb-1">
                                {pred.match ? (
                                    <>
                                      {pred.match.home_team} <span className="text-slate-400 font-normal">vs</span> {pred.match.away_team}
                                    </>
                                ) : (
                                    <span className="text-red-400">Match Data Unavailable</span>
                                )}
                            </div>
                            
                            {/* User's Prediction */}
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold border border-slate-200 uppercase">
                                    Pick: {pred.predicted_outcome}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono font-bold">
                                    ({pred.predicted_home_score} - {pred.predicted_away_score})
                                </span>
                            </div>
                        </div>
                        
                        {/* Status / Points */}
                        <div className="text-right">
                            {pred.status === 'pending' ? (
                                <span className="text-[9px] font-black text-yellow-600 bg-yellow-100 px-2 py-1 rounded">PENDING</span>
                            ) : (
                                <span className={`text-[9px] font-black px-2 py-1 rounded ${pred.points_awarded > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {pred.points_awarded > 0 ? `+${pred.points_awarded} PTS` : 'LOST'}
                                </span>
                            )}
                            <div className="text-[9px] text-slate-300 mt-1">
                                {new Date(pred.created_at).toLocaleDateString()}
                            </div>
                        </div>
                     </div>
                 ))
             ) : (
                 <div className="p-8 text-center">
                    <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-300">
                        <AlertCircle size={20} />
                    </div>
                    <p className="text-xs font-bold text-slate-500">No predictions found.</p>
                    <Link href="/" className="text-[10px] font-bold text-blue-600 mt-2 block hover:underline">
                        Go to Home to Predict
                    </Link>
                 </div>
             )}
          </div>
      </div>

    </div>
  );
}