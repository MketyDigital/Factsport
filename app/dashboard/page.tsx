// ✅ RUNS ON EDGE
export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { 
  Trophy, TrendingUp, History, Star, User as UserIcon, 
  AlertCircle, Ticket, Youtube, Facebook, Gift, ArrowRight, ExternalLink 
} from 'lucide-react';
import SignOutButton from '@/app/components/SignOutButton';

async function getUserData() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const { data: predictions } = await supabase
    .from('predictions')
    .select('*, match:matches(home_team, away_team, home_score, away_score, status)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  return { user, profile, predictions };
}

export default async function Dashboard() {
  const data = await getUserData();

  if (!data) {
    redirect('/login');
  }

  const { profile, predictions } = data;

  return (
    <div className="min-h-screen bg-[#F0F2F5] pb-24 font-sans">
      
      {/* --- HEADER --- */}
      <div className="bg-[#0a1428] text-white pt-8 pb-20 px-6 rounded-b-[2.5rem] relative overflow-hidden shadow-2xl">
        {/* Background FX */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-red-600 rounded-full blur-[80px] opacity-10"></div>
        
        {/* Nav */}
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

        {/* STATS CARDS */}
        <div className="grid grid-cols-2 gap-3 relative z-10">
            {/* Points */}
            <div className="bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-12 h-12 bg-green-500 blur-[30px] opacity-20"></div>
                <div className="flex items-center gap-2 mb-2 text-slate-300 text-[10px] font-bold uppercase tracking-wider">
                    <TrendingUp size={12} className="text-green-400" /> Total Points
                </div>
                <div className="text-3xl font-black tracking-tighter">{profile?.points || 0}</div>
            </div>

            {/* VIP Status */}
            <Link href="/vip/upgrade">
                <div className={`p-4 rounded-2xl border relative overflow-hidden transition active:scale-95 ${profile?.is_vip ? 'bg-gradient-to-br from-yellow-600 to-yellow-800 border-yellow-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                    <div className="flex items-center gap-2 mb-2 text-white/80 text-[10px] font-bold uppercase tracking-wider">
                        <Trophy size={12} className={profile?.is_vip ? 'text-white' : 'text-slate-400'} /> Status
                    </div>
                    <div className="text-lg font-black uppercase tracking-wide flex items-center justify-between">
                        {profile?.is_vip ? 'VIP Member' : 'Free Plan'}
                        {!profile?.is_vip && <span className="text-[9px] bg-red-600 text-white px-2 py-1 rounded-full animate-pulse shadow-lg">UPGRADE</span>}
                    </div>
                </div>
            </Link>
        </div>
      </div>

      {/* --- BODY CONTENT --- */}
      <div className="px-4 -mt-12 relative z-20 space-y-4">
        
        {/* 1. REVENUE CARD (The Money Maker) */}
        <div className="bg-gradient-to-r from-[#1a1a1a] to-black rounded-2xl p-4 shadow-xl border border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500 blur-[60px] opacity-10"></div>
            
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <h3 className="text-yellow-400 font-black text-sm uppercase italic mb-1 flex items-center gap-2">
                        <Ticket size={16} /> Exclusive Partner Deal
                    </h3>
                    <p className="text-slate-400 text-xs mb-3 w-[90%]">
                        Sign up on <span className="text-white font-bold">1xBet</span> & get 300% Bonus on your first deposit!
                    </p>
                    <div className="bg-white/10 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10">
                        <span className="text-[10px] text-slate-400 uppercase">Promo Code:</span>
                        <span className="text-yellow-400 font-black text-sm tracking-widest">FACTSPORT</span>
                    </div>
                </div>
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                    {/* Placeholder Logo - Replace with actual 1xBet/Melbet logo URL */}
                    <span className="text-black font-black text-xs">1X</span>
                </div>
            </div>
            
            <Link href="https://bit.ly/your-affiliate-link" target="_blank" className="mt-4 w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs uppercase py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-lg active:scale-95">
                Claim Bonus Now <ExternalLink size={14} />
            </Link>
        </div>

        {/* 2. DAILY REWARD (Gamification) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
                    <Gift size={20} />
                </div>
                <div>
                    <h4 className="font-bold text-sm text-slate-800">Daily Login Bonus</h4>
                    <p className="text-[10px] text-slate-500">Come back tomorrow for +5 Pts</p>
                </div>
            </div>
            <button className="bg-slate-100 text-slate-400 text-[10px] font-bold px-3 py-1.5 rounded-full cursor-not-allowed">
                Claimed
            </button>
        </div>

        {/* 3. PREDICTION HISTORY */}
        <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2 px-2">
                <History size={14} /> Recent Activity
            </h3>
            
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {predictions && predictions.length > 0 ? (
                    predictions.map((pred: any) => (
                        <div key={pred.id} className="p-4 border-b border-slate-50 last:border-0 flex justify-between items-center hover:bg-slate-50 transition">
                            <div>
                                <div className="text-xs font-bold text-slate-800 mb-1">
                                    {pred.match?.home_team} <span className="text-slate-400 text-[10px] font-normal">vs</span> {pred.match?.away_team}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold border border-slate-200">
                                        {pred.selection}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        {new Date(pred.created_at).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Status Badge */}
                            <div>
                                {pred.status === 'won' && <span className="text-[9px] font-black text-green-700 bg-green-100 px-2 py-1 rounded shadow-sm">WON</span>}
                                {pred.status === 'lost' && <span className="text-[9px] font-black text-red-700 bg-red-100 px-2 py-1 rounded shadow-sm">LOST</span>}
                                {pred.status === 'pending' && <span className="text-[9px] font-black text-yellow-700 bg-yellow-100 px-2 py-1 rounded shadow-sm">PENDING</span>}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-8">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-300">
                            <AlertCircle size={24} />
                        </div>
                        <p className="text-xs font-bold text-slate-500">No predictions yet</p>
                        <Link href="/" className="text-[10px] font-bold text-blue-600 mt-2 block hover:underline">
                            Start Winning Today
                        </Link>
                    </div>
                )}
            </div>
            {predictions && predictions.length > 0 && (
                <div className="text-center mt-2">
                    <button className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition">View Full History</button>
                </div>
            )}
        </div>

        {/* 4. SOCIAL MEDIA COMMUNITY */}
        <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2 px-2 mt-6">
                <Star size={14} /> Join Community
            </h3>
            <div className="grid grid-cols-2 gap-3">
                <Link href="https://youtube.com/@yourchannel" target="_blank" className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3 hover:bg-slate-50 transition group">
                    <div className="w-10 h-10 bg-red-50 text-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Youtube size={20} />
                    </div>
                    <div>
                        <div className="text-xs font-black text-slate-800">YouTube</div>
                        <div className="text-[9px] text-slate-400">Watch Analysis</div>
                    </div>
                </Link>
                
                <Link href="https://facebook.com/yourpage" target="_blank" className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3 hover:bg-slate-50 transition group">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Facebook size={20} />
                    </div>
                    <div>
                        <div className="text-xs font-black text-slate-800">Facebook</div>
                        <div className="text-[9px] text-slate-400">Join Group</div>
                    </div>
                </Link>
            </div>
        </div>

      </div>
    </div>
  );
}