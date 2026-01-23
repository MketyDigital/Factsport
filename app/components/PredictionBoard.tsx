'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Loader2, Lock, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PredictionBoard({ matchId, matchDate, homeTeam, awayTeam }: any) {
  const [loading, setLoading] = useState(false);
  const [existingPred, setExistingPred] = useState<any>(null);
  const [outcome, setOutcome] = useState<string>(''); 
  const [scoreHome, setScoreHome] = useState<string>('');
  const [scoreAway, setScoreAway] = useState<string>('');
  
  const supabase = createClient();
  const router = useRouter();

  // 🔒 Lock if match started
  const isLocked = new Date() > new Date(matchDate);

  useEffect(() => { fetchPrediction(); }, []);

  const fetchPrediction = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from('user_predictions').select('*').eq('match_id', matchId).eq('user_id', session.user.id).single();
    if (data) setExistingPred(data);
  };

  const handleSubmit = async () => {
    if (!outcome || scoreHome === '' || scoreAway === '') { alert("Select Winner & Score"); return; }
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }

    const { error } = await supabase.from('user_predictions').insert({
        match_id: matchId, user_id: session.user.id,
        predicted_outcome: outcome, predicted_home_score: parseInt(scoreHome), predicted_away_score: parseInt(scoreAway)
    });

    if (error) {
        if (error.code === '23505') { alert("Already predicted!"); fetchPrediction(); } // Prevent duplicates
        else alert("Error: " + error.message);
    } else {
        fetchPrediction();
    }
    setLoading(false);
  };

  if (isLocked) {
    return (
        <div className="bg-slate-100 rounded-xl p-6 text-center border border-slate-200">
            <Lock className="mx-auto text-slate-400 mb-2" size={24} />
            <h3 className="text-slate-500 font-bold uppercase text-xs">Prediction Closed</h3>
            <p className="text-[10px] text-slate-400">Match has started.</p>
            {existingPred && (
                <div className="mt-4 bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Your Pick</p>
                    <div className="text-sm font-black text-slate-800 mt-1">{existingPred.predicted_outcome.toUpperCase()} ({existingPred.predicted_home_score}-{existingPred.predicted_away_score})</div>
                    {existingPred.status === 'settled' && <div className={`mt-2 text-[10px] font-bold px-2 py-1 rounded inline-block ${existingPred.points_awarded > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{existingPred.points_awarded > 0 ? `+${existingPred.points_awarded} Points` : '0 Points'}</div>}
                </div>
            )}
        </div>
    );
  }

  if (existingPred) {
    return (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <CheckCircle className="mx-auto text-green-600 mb-2" size={32} />
            <h3 className="text-green-800 font-bold uppercase text-sm">Locked In</h3>
            <div className="flex justify-center gap-6 mt-3 bg-white p-3 rounded-lg shadow-sm">
                <div><p className="text-[9px] text-slate-400 uppercase">Winner</p><p className="font-black text-slate-800 uppercase">{existingPred.predicted_outcome === 'home' ? homeTeam : existingPred.predicted_outcome === 'away' ? awayTeam : 'Draw'}</p></div>
                <div><p className="text-[9px] text-slate-400 uppercase">Score</p><p className="font-black text-slate-800">{existingPred.predicted_home_score} - {existingPred.predicted_away_score}</p></div>
            </div>
        </div>
    );
  }

  return (
    <div className="space-y-6">
        <div>
            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 flex items-center gap-2"><span className="bg-blue-600 text-white px-1.5 py-0.5 rounded">3 Pts</span> Match Winner</h4>
            <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setOutcome('home')} className={`py-3 rounded-xl font-bold text-xs border transition ${outcome === 'home' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-slate-50'}`}>{homeTeam}</button>
                <button onClick={() => setOutcome('draw')} className={`py-3 rounded-xl font-bold text-xs border transition ${outcome === 'draw' ? 'bg-slate-600 text-white' : 'bg-white hover:bg-slate-50'}`}>Draw</button>
                <button onClick={() => setOutcome('away')} className={`py-3 rounded-xl font-bold text-xs border transition ${outcome === 'away' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-slate-50'}`}>{awayTeam}</button>
            </div>
        </div>
        <div>
            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 flex items-center gap-2"><span className="bg-yellow-500 text-black px-1.5 py-0.5 rounded">10 Pts</span> Correct Score</h4>
            <div className="flex items-center justify-center gap-4 bg-white p-4 rounded-xl border border-slate-200">
                <div className="text-center"><label className="text-[9px] font-bold text-slate-400 block mb-1">{homeTeam}</label><input type="number" min="0" className="w-16 h-12 text-center text-2xl font-black border border-slate-200 rounded-lg bg-slate-50" value={scoreHome} onChange={(e) => setScoreHome(e.target.value)} /></div>
                <span className="text-xl font-black text-slate-300">-</span>
                <div className="text-center"><label className="text-[9px] font-bold text-slate-400 block mb-1">{awayTeam}</label><input type="number" min="0" className="w-16 h-12 text-center text-2xl font-black border border-slate-200 rounded-lg bg-slate-50" value={scoreAway} onChange={(e) => setScoreAway(e.target.value)} /></div>
            </div>
        </div>
        <button onClick={handleSubmit} disabled={loading} className="w-full bg-slate-900 text-white font-black uppercase py-4 rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" /> : "Submit Prediction"}</button>
    </div>
  );
}