'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Loader2, Lock, CheckCircle, Trophy, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PredictionBoard({ matchId, matchDate, homeTeam, awayTeam }: any) {
  const [loading, setLoading] = useState(false);
  const [existingPred, setExistingPred] = useState<any>(null);
  const [outcome, setOutcome] = useState<string>(''); 
  const [scoreHome, setScoreHome] = useState<string>('');
  const [scoreAway, setScoreAway] = useState<string>('');
   
  const supabase = createClient();
  const router = useRouter();

  // 🔒 VISUAL LOCK: Updates when component renders
  const isLocked = new Date() > new Date(matchDate);

  useEffect(() => { fetchPrediction(); }, []);

  const fetchPrediction = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    // ✅ Correct Table
    const { data } = await supabase
        .from('user_predictions')
        .select('*')
        .eq('match_id', matchId) 
        .eq('user_id', session.user.id)
        .single();
        
    if (data) setExistingPred(data);
  };

  const handleSubmit = async () => {
    // 1. Basic Validation
    if (!outcome || scoreHome === '' || scoreAway === '') { 
        alert("Select Winner & Score"); 
        return; 
    }

    // 🛡️ SECURITY LAYER 2: TIME CHECK
    // We check the time RIGHT NOW, inside the function.
    // This prevents users from betting if they kept the tab open past kickoff.
    const now = new Date();
    const kickoff = new Date(matchDate);
    if (now >= kickoff) {
        alert("⛔ Betting Closed! The match has already started.");
        window.location.reload(); // Refresh to show the locked UI
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
        status: 'PENDING' 
    });

    if (error) {
        if (error.code === '23505') { 
            alert("Already predicted!"); 
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
    // Check if status is finalized (WON or LOST)
    const status = existingPred?.status?.toUpperCase();
    const isFinalized = status === 'WON' || status === 'LOST';

    return (
        <div className="bg-slate-100 rounded-xl p-6 text-center border border-slate-200">
            <Lock className="mx-auto text-slate-400 mb-2" size={24} />
            <h3 className="text-slate-500 font-bold uppercase text-xs">Prediction Closed</h3>
            <p className="text-[10px] text-slate-400">Match has started.</p>
            
            {existingPred && (
                <div className="mt-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Your Prediction</p>
                    
                    <div className="flex justify-center items-center gap-4 mb-3">
                         <div className="text-center">
                            <div className="text-[10px] uppercase text-slate-400">Winner</div>
                            <div className="font-black text-slate-800 text-sm uppercase">{existingPred.predicted_outcome}</div>
                         </div>
                         <div className="h-8 w-px bg-slate-100"></div>
                         <div className="text-center">
                            <div className="text-[10px] uppercase text-slate-400">Score</div>
                            <div className="font-black text-slate-800 text-sm">{existingPred.predicted_home_score} - {existingPred.predicted_away_score}</div>
                         </div>
                    </div>

                    {isFinalized ? (
                        <div className={`text-xs font-black px-3 py-2 rounded-lg inline-flex items-center gap-2 ${existingPred.points_awarded > 0 ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                           {existingPred.points_awarded > 0 ? (
                               <><Trophy size={14} /> WON +{existingPred.points_awarded} PTS</>
                           ) : (
                               <><XCircle size={14} /> LOST</>
                           )}
                        </div>
                    ) : (
                        <div className="text-[10px] font-bold bg-yellow-50 text-yellow-600 px-2 py-1 rounded border border-yellow-100 inline-block">
                            PENDING RESULT...
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
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-400 rounded-full blur-[50px] opacity-20"></div>
            <CheckCircle className="mx-auto text-green-600 mb-2 relative z-10" size={32} />
            <h3 className="text-green-800 font-bold uppercase text-sm relative z-10">Prediction Locked In</h3>
            <p className="text-[10px] text-green-600 mb-4 relative z-10">Good luck! Edit not allowed.</p>
            
            <div className="flex justify-center gap-6 mt-3 bg-white/80 backdrop-blur-sm p-3 rounded-lg shadow-sm border border-green-100 relative z-10">
                <div>
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Winner</p>
                    <p className="font-black text-slate-800 uppercase text-sm">
                        {existingPred.predicted_outcome === 'home' ? 'Home' : existingPred.predicted_outcome === 'away' ? 'Away' : 'Draw'}
                    </p>
                </div>
                <div className="w-px bg-slate-200"></div>
                <div>
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Score</p>
                    <p className="font-black text-slate-800 text-sm">
                        {existingPred.predicted_home_score} - {existingPred.predicted_away_score}
                    </p>
                </div>
            </div>
        </div>
    );
  }

  // --- RENDER: FORM ---
  return (
    <div className="space-y-6">
        <div>
            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 flex items-center gap-2"><span className="bg-blue-600 text-white px-1.5 py-0.5 rounded">3 Pts</span> Match Winner</h4>
            <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setOutcome('home')} className={`py-3 rounded-xl font-bold text-xs border transition ${outcome === 'home' ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' : 'bg-white hover:bg-slate-50 border-slate-200'}`}>{homeTeam}</button>
                <button onClick={() => setOutcome('draw')} className={`py-3 rounded-xl font-bold text-xs border transition ${outcome === 'draw' ? 'bg-slate-600 text-white border-slate-600 shadow-md transform scale-105' : 'bg-white hover:bg-slate-50 border-slate-200'}`}>Draw</button>
                <button onClick={() => setOutcome('away')} className={`py-3 rounded-xl font-bold text-xs border transition ${outcome === 'away' ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' : 'bg-white hover:bg-slate-50 border-slate-200'}`}>{awayTeam}</button>
            </div>
        </div>
        <div>
            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 flex items-center gap-2"><span className="bg-yellow-500 text-black px-1.5 py-0.5 rounded">10 Pts</span> Correct Score</h4>
            <div className="flex items-center justify-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-center">
                    <label className="text-[9px] font-bold text-slate-400 block mb-1">{homeTeam}</label>
                    <input type="number" min="0" className="w-16 h-12 text-center text-2xl font-black border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" value={scoreHome} onChange={(e) => setScoreHome(e.target.value)} />
                </div>
                <span className="text-xl font-black text-slate-300">-</span>
                <div className="text-center">
                    <label className="text-[9px] font-bold text-slate-400 block mb-1">{awayTeam}</label>
                    <input type="number" min="0" className="w-16 h-12 text-center text-2xl font-black border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" value={scoreAway} onChange={(e) => setScoreAway(e.target.value)} />
                </div>
            </div>
        </div>
        <button onClick={handleSubmit} disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black uppercase py-4 rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
            {loading ? <Loader2 className="animate-spin" /> : "Submit Prediction"}
        </button>
    </div>
  );
}