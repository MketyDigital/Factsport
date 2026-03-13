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

  if (isLocked) {
    const status = existingPred?.status?.toUpperCase();
    const isFinalized = status === 'WON' || status === 'LOST';

    return (
        <div className="bg-[#f8f9fa] rounded-xl p-4 text-center border border-slate-200 shadow-inner relative overflow-hidden">
            <div className="absolute -left-10 -top-10 w-24 h-24 bg-slate-200 rounded-full blur-[30px] opacity-50"></div>
            
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm border border-slate-100 relative z-10">
                <Lock className="text-slate-400" size={14} />
            </div>
            <h3 className="text-slate-800 font-black uppercase tracking-widest text-[10px] relative z-10">Market Closed</h3>
            
            {existingPred && (
                <div className="mt-3 bg-white p-3 rounded-xl shadow-sm border border-slate-100 relative z-10">
                    <div className="flex justify-center items-center gap-2 mb-3">
                         <div className="text-center flex-1 bg-slate-50 p-1.5 rounded border border-slate-100">
                            <div className="text-[7px] uppercase font-bold text-slate-400 tracking-widest mb-0.5">Winner</div>
                            <div className="font-black text-slate-800 text-[10px] uppercase">{existingPred.predicted_outcome}</div>
                         </div>
                         <div className="text-center flex-1 bg-slate-50 p-1.5 rounded border border-slate-100">
                            <div className="text-[7px] uppercase font-bold text-slate-400 tracking-widest mb-0.5">Score</div>
                            <div className="font-black text-slate-800 text-[10px]">{existingPred.predicted_home_score} - {existingPred.predicted_away_score}</div>
                         </div>
                    </div>

                    {isFinalized ? (
                        <div className={`w-full text-[9px] font-black uppercase tracking-widest py-1.5 rounded-lg flex items-center justify-center gap-1 ${existingPred.points_awarded > 0 ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-500 border border-red-100'}`}>
                           {existingPred.points_awarded > 0 ? (
                               <><Trophy size={10} className="text-green-500"/> +{existingPred.points_awarded} PTS</>
                           ) : (
                               <><XCircle size={10} /> BUSTED</>
                           )}
                        </div>
                    ) : (
                        <div className="w-full text-[8px] font-black uppercase tracking-widest bg-yellow-50 text-yellow-600 py-1.5 rounded-lg border border-yellow-200 flex items-center justify-center gap-1">
                            <Loader2 size={10} className="animate-spin" /> PENDING
                        </div>
                    )}
                </div>
            )}
        </div>
    );
  }

  if (existingPred) {
    return (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 text-center relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-400 rounded-full blur-[50px] opacity-10 pointer-events-none"></div>
            
            <div className="flex items-center justify-center gap-2 mb-3 relative z-10">
                <CheckCircle className="text-green-500" size={16} />
                <h3 className="text-green-800 font-black uppercase tracking-tighter text-sm">Slip Locked</h3>
            </div>
            
            <div className="flex justify-center gap-2 bg-white/60 backdrop-blur-md p-2 rounded-lg shadow-sm border border-green-100 relative z-10">
                <div className="flex-1 bg-white p-2 rounded border border-slate-100 shadow-sm">
                    <p className="text-[7px] text-slate-400 uppercase font-black tracking-widest mb-0.5">Winner</p>
                    <p className="font-black text-slate-800 uppercase text-[10px]">
                        {existingPred.predicted_outcome === 'home' ? 'Home' : existingPred.predicted_outcome === 'away' ? 'Away' : 'Draw'}
                    </p>
                </div>
                <div className="flex-1 bg-white p-2 rounded border border-slate-100 shadow-sm">
                    <p className="text-[7px] text-slate-400 uppercase font-black tracking-widest mb-0.5">Score</p>
                    <p className="font-black text-slate-800 text-[10px]">
                        {existingPred.predicted_home_score} - {existingPred.predicted_away_score}
                    </p>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="space-y-3 relative z-10">
        
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-widest flex items-center gap-1">
                    <Target size={10} className="text-blue-500"/> Winner
                </h4>
                <span className="bg-blue-100 text-blue-700 font-black text-[7px] px-1.5 py-0.5 rounded shadow-sm border border-blue-200">3 PTS</span>
            </div>
            
            <div className="grid grid-cols-3 gap-1.5">
                <button onClick={() => setOutcome('home')} className={`py-2 rounded-lg font-black text-[9px] uppercase tracking-tight border-2 transition-all duration-300 ${outcome === 'home' ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'}`}>
                    <span className="block truncate px-1">{homeTeam}</span>
                </button>
                <button onClick={() => setOutcome('draw')} className={`py-2 rounded-lg font-black text-[9px] uppercase tracking-widest border-2 transition-all duration-300 ${outcome === 'draw' ? 'bg-slate-800 text-white border-slate-800 shadow-md transform scale-105' : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'}`}>
                    Draw
                </button>
                <button onClick={() => setOutcome('away')} className={`py-2 rounded-lg font-black text-[9px] uppercase tracking-tight border-2 transition-all duration-300 ${outcome === 'away' ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'}`}>
                    <span className="block truncate px-1">{awayTeam}</span>
                </button>
            </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-widest flex items-center gap-1">
                    <TrendingUp size={10} className="text-yellow-500"/> Score
                </h4>
                <span className="bg-yellow-100 text-yellow-700 font-black text-[7px] px-1.5 py-0.5 rounded shadow-sm border border-yellow-300">10 PTS</span>
            </div>

            <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                <div className="text-center w-[40%]">
                    <label className="text-[8px] font-black text-slate-400 block mb-1 uppercase tracking-tight truncate">{homeTeam}</label>
                    <input 
                        type="number" min="0" max="20"
                        className="w-full h-8 text-center text-lg font-black border-2 border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors" 
                        value={scoreHome} 
                        onChange={(e) => setScoreHome(e.target.value)} 
                        placeholder="-"
                    />
                </div>
                <div className="w-[20%] flex justify-center">
                    <span className="text-sm font-black text-slate-300 italic pt-3">VS</span>
                </div>
                <div className="text-center w-[40%]">
                    <label className="text-[8px] font-black text-slate-400 block mb-1 uppercase tracking-tight truncate">{awayTeam}</label>
                    <input 
                        type="number" min="0" max="20"
                        className="w-full h-8 text-center text-lg font-black border-2 border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors" 
                        value={scoreAway} 
                        onChange={(e) => setScoreAway(e.target.value)} 
                        placeholder="-"
                    />
                </div>
            </div>
        </div>

        <button 
            onClick={handleSubmit} 
            disabled={loading} 
            className="w-full bg-[#0a1428] hover:bg-blue-900 text-white font-black uppercase tracking-widest py-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed border border-slate-800 text-[10px]"
        >
            {loading ? <Loader2 className="animate-spin" size={14} /> : <><CheckCircle size={14}/> Lock In Prediction</>}
        </button>
    </div>
  );
}