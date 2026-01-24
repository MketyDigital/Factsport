// ✅ RUNS ON EDGE
export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { 
  Trophy, TrendingUp, History, Star, User as UserIcon, 
  ExternalLink, Zap, Crown, CheckCircle, AlertCircle, Lock,
  Send, DollarSign, Globe
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

  // 2. Fetch Predictions
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

  // Qualification Logic
  const csCount = profile?.monthly_correct_scores || 0;
  const csTarget = 3;
  const csProgress = Math.min((csCount / csTarget) * 100, 100);
  const isCsQualified = csCount >= csTarget;
  const isFullyQualified = isCsQualified && isVipActive;

  // 🔗 LINKS CONFIGURATION (Edit these!)
  const TELEGRAM_LINK = "https://t.me/factsportlive"; 
  const BETTING_PARTNER_LINK = "https://melbet.com"; // or 1xbet link
  const PARTNER_NAME = "Melbet";

  return (
    <div className="min-h-screen bg-[#F0F2F5] pb-24 font-sans text-slate-900">
       
      {/* --- 1. HEADER SECTION --- */}
      <div className="bg-[#0a1428] text-white pt-8 pb-24 px-6 rounded-b-[2.5rem] relative overflow-hidden shadow-2xl">
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

      {/* --- 2. STATS CARDS --- */}
      <div className="grid grid-cols-2 gap-3 px-4 -mt-16 relative z-20 mb-4">
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

      {/* --- 3. QUALIFICATION TRACKER --- */}
      <div className="px-4 mb-4">
        <div className={`rounded-2xl border p-4 shadow-sm relative overflow-hidden ${isFullyQualified ? 'bg-gradient-to-r from-green-900 to-emerald-900 border-green-700 text-white' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-between items-start mb-2 relative z-10">
                <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isFullyQualified ? 'text-green-300' : 'text-slate-400'}`}>
                    {isFullyQualified ? <CheckCircle size={14} /> : <Trophy size={14} className="text-yellow-500" />} 
                    Prize Eligibility
                </h3>
                {isFullyQualified && <span className="bg-green-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">Qualified</span>}
            </div>

            <div className="relative z-10 mb-3">
                <div className="flex justify-between text-[10px] font-bold mb-1">
                    <span className={isFullyQualified ? "text-green-100" : "text-slate-600"}>Correct Scores ({csCount}/{csTarget})</span>
                    <span className={isFullyQualified ? "text-green-100" : "text-slate-400"}>{Math.round(csProgress)}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-100">
                    <div className={`h-full transition-all duration-1000 ${isFullyQualified ? 'bg-yellow-400' : 'bg-blue-600'}`} style={{ width: `${csProgress}%` }}></div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 relative z-10">
                <div className={`flex items-center gap-2 text-[10px] font-bold p-2 rounded-lg border ${isCsQualified ? (isFullyQualified ? 'bg-white/10 border-white/10 text-white' : 'bg-green-50 border-green-200 text-green-700') : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                    {isCsQualified ? <CheckCircle size={12} /> : <div className="w-3 h-3 rounded-full border-2 border-slate-300"></div>}
                    <span>Hit 3 Exact Scores</span>
                </div>
                <div className={`flex items-center gap-2 text-[10px] font-bold p-2 rounded-lg border ${isVipActive ? (isFullyQualified ? 'bg-white/10 border-white/10 text-white' : 'bg-green-50 border-green-200 text-green-700') : 'bg-red-50 border-red-100 text-red-700 animate-pulse'}`}>
                    {isVipActive ? <CheckCircle size={12} /> : <Lock size={12} />}
                    <span>{isVipActive ? 'VIP Active' : 'VIP Required'}</span>
                </div>
            </div>
            {!isVipActive && isCsQualified && (
                <div className="mt-3 bg-red-100 text-red-800 text-[10px] font-bold px-3 py-2 rounded-lg flex items-center gap-2 border border-red-200">
                    <AlertCircle size={14} /> You have the scores, but you need VIP to win!
                </div>
            )}
        </div>
      </div>

      {/* --- 4. 📢 COMMUNITY & OFFERS (New Section) --- */}
      <div className="px-4 mb-6">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">Community & Offers</h3>
        <div className="grid grid-cols-2 gap-3">
            {/* Telegram Button */}
            <a href={TELEGRAM_LINK} target="_blank" rel="noopener noreferrer" className="bg-[#229ED9] hover:bg-[#1e8dbf] text-white p-3 rounded-xl shadow-lg shadow-blue-200 transition active:scale-95 flex flex-col justify-between h-20 relative overflow-hidden">
                 <div className="absolute -right-2 -bottom-2 opacity-20">
                    <Send size={48} />
                 </div>
                 <div className="flex items-center gap-2">
                    <Send size={16} />
                    <span className="text-[10px] font-bold uppercase opacity-80">Join Channel</span>
                 </div>
                 <span className="text-xs font-black">Get Live Tips 🚀</span>
            </a>

            {/* Betting Partner Button */}
            <a href={BETTING_PARTNER_LINK} target="_blank" rel="noopener noreferrer" className="bg-slate-900 hover:bg-black text-white p-3 rounded-xl shadow-lg shadow-slate-200 transition active:scale-95 flex flex-col justify-between h-20 relative overflow-hidden border border-slate-700">
                 <div className="absolute -right-2 -bottom-2 opacity-20 text-yellow-500">
                    <DollarSign size={48} />
                 </div>
                 <div className="flex items-center gap-2">
                    <Globe size={16} className="text-yellow-500" />
                    <span className="text-[10px] font-bold uppercase opacity-80 text-yellow-500">Partner</span>
                 </div>
                 <span className="text-xs font-black">Bet on {PARTNER_NAME}</span>
            </a>
        </div>
      </div>

      {/* --- 5. PREDICTION HISTORY --- */}
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
                            <div className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                                {pred.match ? (
                                    <>
                                      {pred.match.home_team} <span className="text-slate-300 text-[10px]">vs</span> {pred.match.away_team}
                                    </>
                                ) : <span className="text-slate-400 italic">Match Data Unavailable</span>}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase border border-slate-200">{pred.predicted_outcome}</span>
                                <span className="text-[10px] text-slate-400 font-mono font-bold">{pred.predicted_home_score} - {pred.predicted_away_score}</span>
                            </div>
                        </div>
                        <div className="text-right">
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
                            <div className="text-[9px] text-slate-300 mt-1 font-medium">{new Date(pred.created_at).toLocaleDateString()}</div>
                        </div>
                     </div>
                 ))
             ) : (
                 <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3 text-slate-300"><Zap size={24} /></div>
                    <p className="text-xs font-bold text-slate-600">No predictions yet</p>
                    <p className="text-[10px] text-slate-400 mb-4 max-w-[200px]">Start predicting matches to earn points and climb the leaderboard.</p>
                    <Link href="/" className="text-xs font-black bg-slate-900 text-white px-5 py-2.5 rounded-xl shadow-lg active:scale-95 transition">Predict Matches</Link>
                 </div>
             )}
          </div>
      </div>
    </div>
  );
}