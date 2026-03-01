// ✅ RUNS ON EDGE
export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { 
  Trophy, Star, User as UserIcon, 
  Crown, CheckCircle, Lock,
  MessageCircle, Settings, Clock, Target, Info, ArrowRight, Award // Award added here for Leaderboard icon
} from 'lucide-react';
import SignOutButton from '@/app/components/SignOutButton';
import DashboardHistory from '@/app/components/DashboardHistory'; 
import FreeTipsBanner from '@/app/components/FreeTipsBanner';

async function getUserData() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, monthly_points, monthly_correct_scores, eligible_monthly_points, eligible_monthly_correct_scores')
    .eq('id', user.id)
    .single();

  const { data: settings } = await supabase
    .from('site_settings')
    .select('target_exact_scores, min_points_floor, daily_limit')
    .limit(1)
    .single();

  const { data: currentPredictions } = await supabase
    .from('user_predictions')
    .select(`
        id, predicted_outcome, predicted_home_score, predicted_away_score, points_awarded, status, created_at, is_eligible_for_prize,
        match:matches ( home_team, away_team, home_score, away_score, status ) 
    `)
    .eq('user_id', user.id)
    .gte('created_at', startOfMonth.toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  let pastWins: any[] = [];
  if (!currentPredictions || currentPredictions.length === 0) {
      const { data: wins } = await supabase
        .from('user_predictions')
        .select(`
            id, predicted_outcome, predicted_home_score, predicted_away_score, points_awarded, status, created_at, is_eligible_for_prize,
            match:matches ( home_team, away_team, home_score, away_score, status ) 
        `)
        .eq('user_id', user.id)
        .lt('created_at', startOfMonth.toISOString())
        .or('status.eq.Won,points_awarded.gt.0')
        .order('created_at', { ascending: false })
        .limit(5);
      pastWins = wins || [];
  }

  // 🟢 Fetch latest Rank #1 winner for the VIP Upsell banner
  const { data: latestWinner } = await supabase
    .from('monthly_winners')
    .select('prize_amount, user:profiles(full_name)')
    .eq('is_approved', true)
    .eq('rank', 1)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return { user, profile, settings, predictions: currentPredictions, pastWins, latestWinner };
}

export default async function Dashboard() {
  const data = await getUserData();
  if (!data) redirect('/login');

  const { profile, settings, predictions, pastWins, latestWinner } = data;
    
  const expiryDate = profile?.vip_expires_at ? new Date(profile.vip_expires_at) : null;
  const isVipActive = profile?.is_vip && (!expiryDate || expiryDate > new Date());

  const csCountEligible = profile?.eligible_monthly_correct_scores || 0;
  const csTarget = settings?.target_exact_scores || 4;
  const csProgress = Math.min((csCountEligible / csTarget) * 100, 100);
  const isCsQualified = csCountEligible >= csTarget;

  const ptsCountEligible = profile?.eligible_monthly_points || 0;
  const ptsTarget = settings?.min_points_floor || 100;
  const isPtsQualified = ptsCountEligible >= ptsTarget;

  const isFullyQualified = isCsQualified && isVipActive && isPtsQualified;

  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysLeft = lastDay.getDate() - today.getDate();

  const formSource = (predictions && predictions.length > 0) ? predictions : pastWins;
  const formGuide = formSource?.slice(0, 5).map((p: any) => {
      const s = p.status?.toLowerCase();
      if(s === 'won' || p.points_awarded > 0) return 'W';
      if(s === 'lost') return 'L';
      return 'P';
  }).reverse() || [];

  // 🟢 TS FIX: Safely extract the name whether Supabase returns an object or an array
  let winnerName = 'A Champion';
  if (latestWinner?.user) {
      winnerName = Array.isArray(latestWinner.user) 
          ? latestWinner.user[0]?.full_name 
          : (latestWinner.user as any).full_name;
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5] pb-24 font-sans text-slate-900">
      <div className="bg-[#0a1428] text-white pt-8 pb-24 px-6 rounded-b-[2.5rem] relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20"></div>
        <div className="relative z-10 flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
                <div className="relative">
                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/10 shadow-inner backdrop-blur-sm">
                        <UserIcon className="text-white" size={20} />
                    </div>
                    {isVipActive && (
                        <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-yellow-900 p-1 rounded-full border-2 border-[#0a1428]">
                            <Crown size={10} strokeWidth={3} />
                        </div>
                    )}
                </div>
                <div>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Welcome back</p>
                    <h1 className="text-xl font-black">{profile?.full_name || 'Champion'}</h1>
                    {formGuide.length > 0 && (
                        <div className="flex gap-1 mt-1">
                            {formGuide.map((result: string, i: number) => (
                                <div key={i} className={`w-2 h-2 rounded-full ${
                                    result === 'W' ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 
                                    result === 'L' ? 'bg-red-500' : 'bg-slate-600'
                                }`} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                <Link href="/dashboard/settings" className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition backdrop-blur-sm">
                    <Settings size={18} className="text-white" />
                </Link>
                <SignOutButton />
            </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 -mt-16 relative z-20 mb-4">
            <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-100 relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-16 h-16 bg-yellow-50 rounded-bl-full -mr-2 -mt-2 transition group-hover:bg-yellow-100"></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-1">
                        <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                            <Star size={12} className="text-yellow-500 fill-yellow-500" /> Total Month
                        </div>
                        <span className="text-[9px] font-bold text-slate-300 flex items-center gap-1">
                            <Clock size={10} /> {daysLeft} days
                        </span>
                    </div>
                    <div className="text-3xl font-black text-slate-900 tracking-tighter">{profile?.monthly_points || 0}</div>
                    <div className="text-[10px] text-slate-500 mt-1 font-medium flex justify-between items-center">
                        <span>Total C.S.: <b className="text-green-600">{profile?.monthly_correct_scores || 0}</b></span>
                        <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center gap-1 border border-slate-200" title="Points from your first predictions daily">
                             <Target size={8}/> Elig: {profile?.eligible_monthly_points || 0}
                        </span>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-100 relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-16 h-16 bg-blue-50 rounded-bl-full -mr-2 -mt-2 transition group-hover:bg-blue-100"></div>
                <div className="relative z-10">
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                        <Trophy size={12} className="text-blue-500" /> All-Time
                    </div>
                    <div className="text-3xl font-black text-slate-900 tracking-tighter">{profile?.points || 0}</div>
                    <div className="text-[10px] text-slate-400 mt-1">Total Lifetime Points</div>
                </div>
            </div>
      </div>

      <div className="px-4 mb-4">
        <div className={`rounded-2xl border p-4 shadow-sm relative overflow-hidden ${isFullyQualified ? 'bg-gradient-to-r from-green-900 to-emerald-900 border-green-700 text-white' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-between items-start mb-2 relative z-10">
                <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isFullyQualified ? 'text-green-300' : 'text-slate-400'}`}>
                    {isFullyQualified ? <CheckCircle size={14} /> : <Trophy size={14} className="text-yellow-500" />} 
                    Prize Eligibility
                </h3>
                {isFullyQualified && <span className="bg-green-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">Qualified</span>}
            </div>
            
            <p className={`text-[9px] mb-3 flex items-center gap-1 ${isFullyQualified ? 'text-green-200/80' : 'text-slate-400'}`}>
                <Info size={10} /> Progress below strictly tracks your eligible predictions.
            </p>

            <div className="relative z-10 mb-3">
                <div className="flex justify-between text-[10px] font-bold mb-1">
                    <span className={isFullyQualified ? "text-green-100" : "text-slate-600"}>Eligible Scores ({csCountEligible}/{csTarget})</span>
                    <span className={isFullyQualified ? "text-green-100" : "text-slate-400"}>{Math.round(csProgress)}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-100">
                    <div className={`h-full transition-all duration-1000 ${isFullyQualified ? 'bg-yellow-400' : 'bg-blue-600'}`} style={{ width: `${csProgress}%` }}></div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 relative z-10">
                <div className={`flex flex-col items-center justify-center text-center gap-1 text-[9px] font-bold p-2 rounded-lg border ${isVipActive ? (isFullyQualified ? 'bg-white/10 border-white/10 text-white' : 'bg-green-50 border-green-200 text-green-700') : 'bg-red-50 border-red-100 text-red-700 animate-pulse'}`}>
                    {isVipActive ? <CheckCircle size={12} /> : <Lock size={12} />}
                    <span>{isVipActive ? 'VIP Active' : 'VIP Required'}</span>
                </div>
                <div className={`flex flex-col items-center justify-center text-center gap-1 text-[9px] font-bold p-2 rounded-lg border ${isCsQualified ? (isFullyQualified ? 'bg-white/10 border-white/10 text-white' : 'bg-green-50 border-green-200 text-green-700') : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                    {isCsQualified ? <CheckCircle size={12} /> : <Target size={12} />}
                    <span>{csTarget} Elig. Scores</span>
                </div>
                <div className={`flex flex-col items-center justify-center text-center gap-1 text-[9px] font-bold p-2 rounded-lg border ${isPtsQualified ? (isFullyQualified ? 'bg-white/10 border-white/10 text-white' : 'bg-green-50 border-green-200 text-green-700') : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                    {isPtsQualified ? <CheckCircle size={12} /> : <Trophy size={12} />}
                    <span>{ptsTarget} Elig. Floor</span>
                </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-slate-100 relative z-10 flex items-center justify-between">
                <span className="text-[9px] text-slate-500 font-medium italic">Remember the Champion's Checklist!</span>
                <Link href="/how-to-play" className="text-[9px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    View full rules <ArrowRight size={10} />
                </Link>
            </div>
        </div>
      </div>

      {/* 🟢 VIP UPSELL BANNER */}
      {!isVipActive && latestWinner && (
        <div className="px-4 mb-4">
            <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-2xl p-4 text-slate-900 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-[60px] opacity-20"></div>
                <div className="relative z-10 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-yellow-900 mb-0.5 flex items-center gap-1">
                            <Trophy size={10} /> Last Month's Winner
                        </p>
                        <h4 className="font-black text-sm">
                            {/* 🟢 Safely uses the extracted winnerName */}
                            {winnerName} won <span className="text-white bg-black/20 px-1.5 py-0.5 rounded">{latestWinner.prize_amount}</span>!
                        </h4>
                        <p className="text-[9px] font-medium text-yellow-900 mt-1">Upgrade to VIP to qualify for this month's prizes.</p>
                    </div>
                    <Link href="/vip/upgrade" className="bg-slate-900 text-yellow-400 text-[10px] font-black uppercase px-3 py-2 rounded-xl shadow-lg shrink-0 hover:bg-black transition active:scale-95">
                        Upgrade
                    </Link>
                </div>
            </div>
        </div>
      )}

      <div className="px-4 mb-6">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">Premium Tools</h3>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="grid grid-cols-2 gap-3 mb-4">
                 <Link href="/vip/upgrade" className="bg-[#0a1428] p-3 rounded-xl flex flex-col items-center justify-center text-center gap-1.5 group relative overflow-hidden active:scale-95 transition">
                    <div className="absolute inset-0 bg-yellow-500/10 group-hover:bg-yellow-500/20 transition"></div>
                    <Lock size={18} className="text-yellow-500" />
                    <div>
                        <div className="text-white font-black text-[10px] uppercase">Get 50+ Odds</div>
                        <div className="text-slate-400 text-[8px]">Upgrade to VIP</div>
                    </div>
                </Link>

                <a href="https://t.me/factsportlive" target="_blank" className="bg-blue-500 p-3 rounded-xl flex flex-col items-center justify-center text-center gap-1.5 hover:bg-blue-600 transition shadow-lg shadow-blue-500/30 active:scale-95">
                    <MessageCircle size={18} className="text-white" />
                    <div>
                        <div className="text-white font-black text-[10px] uppercase">Join Channel</div>
                        <div className="text-blue-100 text-[8px]">Free Codes Daily</div>
                    </div>
                </a>
            </div>
            <FreeTipsBanner />
        </div>
      </div>

      {/* 🚀 🟢 NEW: QUICK ACTION LINKS RESTORED */}
      <div className="grid grid-cols-3 gap-3 px-4 pb-6">
          <Link href="/matches" className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition hover:shadow-md">
              <Trophy className="text-yellow-500" size={20} />
              <span className="text-[10px] font-bold text-slate-700">Predict</span>
          </Link>
          <Link href="/leaderboard" className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition hover:shadow-md">
              <Award className="text-yellow-500" size={20} />
              <span className="text-[10px] font-bold text-slate-700">Leaders</span>
          </Link>
          <a href="https://t.me/factsportlive" target="_blank" rel="noopener noreferrer" className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition hover:shadow-md">
              <MessageCircle className="text-blue-500" size={20} />
              <span className="text-[10px] font-bold text-slate-700">Community</span>
          </a>
      </div>

      <DashboardHistory predictions={predictions || []} pastWins={pastWins || []} />
    </div>
  );
}