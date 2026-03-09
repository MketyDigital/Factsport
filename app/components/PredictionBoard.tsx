'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Loader2, Lock, CheckCircle, Trophy, XCircle, Target, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PredictionBoard({ matchId, matchDate, homeTeam, awayTeam }: any) {
  const [loading, setLoading] = useState(false);
  const [existingPred, setExistingPred] = useState<any>(null);
  const [outcome, setOutcome] = useState<string>(''); 
  const [scoreHome, setScoreHome] = useState<string>('');
  const [scoreAway, setScoreAway] = useState<string>('');
   
  const supabase = createClient();
  const router = useRouter();

  // 🔒 VISUAL LOCK
  const isLocked = new Date() > new Date(matchDate);

  useEffect(() => { fetchPrediction(); }, []);

  const fetchPrediction = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const { data } = await supabase
        .from('user_predictions')
        .select('*')
        .eq('match_id', matchId) 
        .eq('user_id', session.user.id)
        .single();
        
    if (data) setExistingPred(data);
  };

  const handleSubmit = async () => {
    if (!outcome || scoreHome === '' || scoreAway === '') { 
        alert("Please select a Winner and predict the exact Correct Score."); 
        return; 
    }

    const now = new Date();
    const kickoff = new Date(matchDate);
    if (now >= kickoff) {
        alert("⛔ Betting Closed! The match has already started.");
        window.location.reload(); 
        return;
    }

    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }

    const { error } = await supabase.from('user_predictions').insert({
        match_id: matchId, 
        user_id: session.user.id,
        predicted_outcome: outcome, 
        predicted_home_score: parseInt(scoreHome), 
        predicted_away_score: parseInt(scoreAway),
        status: 'PENDING',
        is_eligible_for_prize: false 
    });

    if (error) {
        if (error.code === '23505') { 
            alert("Prediction already locked in!"); 
            fetchPrediction(); 
        }
        else alert("Error: " + error.message);
    } else {
        fetchPrediction();
    }
    setLoading(false);
  };

  // --- RENDER: LOCKED / STARTED ---
  if (isLocked) {
    const status = existingPred?.status?.toUpperCase();
    const isFinalized = status === 'WON' || status === 'LOST';

    return (
        <div className="bg-[#f8f9fa] rounded-2xl p-6 md:p-8 text-center border border-slate-200 shadow-inner relative overflow-hidden">
            <div className="absolute -left-10 -top-10 w-32 h-32 bg-slate-200 rounded-full blur-[40px] opacity-50"></div>
            
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-md border border-slate-100 relative z-10">
                <Lock className="text-slate-400" size={24} />
            </div>
            <h3 className="text-slate-800 font-black uppercase tracking-widest text-sm relative z-10">Market Closed</h3>
            <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-1 relative z-10">Kickoff has passed.</p>
            
            {existingPred && (
                <div className="mt-6 bg-white p-5 rounded-2xl shadow-[0_5px_15px_rgba(0,0,0,0.05)] border border-slate-100 relative z-10">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 bg-slate-50 inline-block px-3 py-1 rounded-full">Your Locked Prediction</p>
                    
                    <div className="flex justify-center items-center gap-6 mb-5">
                         <div className="text-center flex-1">
                            <div className="text-[9px] uppercase font-bold text-slate-400 tracking-widest mb-1">Match Winner</div>
                            <div className="font-black text-slate-800 text-sm uppercase bg-slate-50 py-2 rounded-lg border border-slate-100">{existingPred.predicted_outcome}</div>
                         </div>
                         <div className="text-center flex-1">
                            <div className="text-[9px] uppercase font-bold text-slate-400 tracking-widest mb-1">Exact Score</div>
                            <div className="font-black text-slate-800 text-sm bg-slate-50 py-2 rounded-lg border border-slate-100">{existingPred.predicted_home_score} - {existingPred.predicted_away_score}</div>
                         </div>
                    </div>

                    {isFinalized ? (
                        <div className={`w-full text-xs font-black uppercase tracking-widest py-3 rounded-xl flex items-center justify-center gap-2 ${existingPred.points_awarded > 0 ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-500 border border-red-100'}`}>
                           {existingPred.points_awarded > 0 ? (
                               <><Trophy size={16} className="text-green-500"/> BOOM! +{existingPred.points_awarded} POINTS</>
                           ) : (
                               <><XCircle size={16} /> SLIP BUSTED</>
                           )}
                        </div>
                    ) : (
                        <div className="w-full text-[10px] font-black uppercase tracking-widest bg-yellow-50 text-yellow-600 py-3 rounded-xl border border-yellow-200 flex items-center justify-center gap-2">
                            <Loader2 size={14} className="animate-spin" /> PENDING SETTLEMENT
                        </div>
                    )}
                </div>
            )}
        </div>
    );
  }

  // --- RENDER: ALREADY PREDICTED (OPEN) ---
  if (existingPred) {
    return (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 md:p-8 text-center relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 w-48 h-48 bg-green-400 rounded-full blur-[60px] opacity-10 pointer-events-none"></div>
            
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_5px_15px_rgba(34,197,94,0.2)] relative z-10">
                <CheckCircle className="text-green-500" size={32} />
            </div>
            <h3 className="text-green-800 font-black uppercase tracking-tighter text-2xl relative z-10 mb-1">Slip Locked</h3>
            <p className="text-xs text-green-600 font-bold relative z-10 mb-6">Your prediction is secure. Good luck!</p>
            
            <div className="flex justify-center gap-4 bg-white/60 backdrop-blur-md p-4 rounded-xl shadow-sm border border-green-100 relative z-10">
                <div className="flex-1 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Winner</p>
                    <p className="font-black text-slate-800 uppercase text-sm">
                        {existingPred.predicted_outcome === 'home' ? 'Home' : existingPred.predicted_outcome === 'away' ? 'Away' : 'Draw'}
                    </p>
                </div>
                <div className="flex-1 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Correct Score</p>
                    <p className="font-black text-slate-800 text-sm">
                        {existingPred.predicted_home_score} - {existingPred.predicted_away_score}
                    </p>
                </div>
            </div>
        </div>
    );
  }

  // --- RENDER: NEW PREDICTION FORM ---
  return (
    <div className="space-y-8 relative z-10">
        
        {/* MARKET 1: WINNER */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-black uppercase text-slate-800 tracking-widest flex items-center gap-2">
                    <Target size={14} className="text-blue-500"/> Match Winner
                </h4>
                <span className="bg-blue-100 text-blue-700 font-black text-[9px] px-2 py-1 rounded shadow-sm border border-blue-200">3 POINTS</span>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
                <button onClick={() => setOutcome('home')} className={`py-4 rounded-xl font-black text-xs uppercase tracking-tight border-2 transition-all duration-300 ${outcome === 'home' ? 'bg-blue-600 text-white border-blue-600 shadow-[0_5px_15px_rgba(37,99,235,0.4)] transform scale-105' : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200 hover:border-slate-300'}`}>
                    <span className="block truncate px-1">{homeTeam}</span>
                </button>
                <button onClick={() => setOutcome('draw')} className={`py-4 rounded-xl font-black text-xs uppercase tracking-widest border-2 transition-all duration-300 ${outcome === 'draw' ? 'bg-slate-800 text-white border-slate-800 shadow-[0_5px_15px_rgba(30,41,59,0.4)] transform scale-105' : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200 hover:border-slate-300'}`}>
                    Draw
                </button>
                <button onClick={() => setOutcome('away')} className={`py-4 rounded-xl font-black text-xs uppercase tracking-tight border-2 transition-all duration-300 ${outcome === 'away' ? 'bg-blue-600 text-white border-blue-600 shadow-[0_5px_15px_rgba(37,99,235,0.4)] transform scale-105' : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200 hover:border-slate-300'}`}>
                    <span className="block truncate px-1">{awayTeam}</span>
                </button>
            </div>
        </div>

        {/* MARKET 2: CORRECT SCORE */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-black uppercase text-slate-800 tracking-widest flex items-center gap-2">
                    <TrendingUp size={14} className="text-yellow-500"/> Correct Score
                </h4>
                <span className="bg-yellow-100 text-yellow-700 font-black text-[9px] px-2 py-1 rounded shadow-sm border border-yellow-300">10 POINTS</span>
            </div>

            <div className="flex items-center justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-center w-[40%]">
                    <label className="text-[10px] font-black text-slate-400 block mb-2 uppercase tracking-tight truncate">{homeTeam}</label>
                    <input 
                        type="number" min="0" max="20"
                        className="w-full h-14 text-center text-3xl font-black border-2 border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors shadow-inner" 
                        value={scoreHome} 
                        onChange={(e) => setScoreHome(e.target.value)} 
                        placeholder="-"
                    />
                </div>
                <div className="w-[20%] flex justify-center">
                    <span className="text-2xl font-black text-slate-300 italic pt-4">VS</span>
                </div>
                <div className="text-center w-[40%]">
                    <label className="text-[10px] font-black text-slate-400 block mb-2 uppercase tracking-tight truncate">{awayTeam}</label>
                    <input 
                        type="number" min="0" max="20"
                        className="w-full h-14 text-center text-3xl font-black border-2 border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors shadow-inner" 
                        value={scoreAway} 
                        onChange={(e) => setScoreAway(e.target.value)} 
                        placeholder="-"
                    />
                </div>
            </div>
        </div>

        {/* SUBMIT BUTTON */}
        <button 
            onClick={handleSubmit} 
            disabled={loading} 
            className="w-full bg-[#0a1428] hover:bg-blue-900 text-white font-black uppercase tracking-widest py-5 rounded-2xl shadow-[0_10px_20px_rgba(10,20,40,0.3)] transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100 border border-slate-800"
        >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <><CheckCircle size={20}/> Lock In Prediction</>}
        </button>
    </div>
  );
}