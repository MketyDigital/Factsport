'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Loader2, CheckCircle, Target, TrendingUp, Zap, Users, Save, ListChecks } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/components/AuthProvider'; 

export default function PredictionBoard({ matchId, matchDate, homeTeam, awayTeam, league, matchData }: any) {
  const [loading, setLoading] = useState(false);
  const [existingPred, setExistingPred] = useState<any>(null);
  const [campaign, setCampaign] = useState<any>(null);

  // Core State
  const [outcome, setOutcome] = useState<string>(''); 
  const [scoreHome, setScoreHome] = useState<string>('');
  const [scoreAway, setScoreAway] = useState<string>('');

  // Bonus Market State
  const [firstScorer, setFirstScorer] = useState<string>('');
  const [redCard, setRedCard] = useState<string>('');
  const [penalty, setPenalty] = useState<string>('');
   
  const supabase = createClient();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth(); 

  // 🟢 THE TRIGGER: Determines if the match has started
  const isLocked = new Date() > new Date(matchDate);

  useEffect(() => { 
      // 🟢 THE DATABASE SHIELD: If match is locked/started, abort immediately! Zero DB reads.
      if (isLocked) return;

      if (user?.id) fetchPrediction(user.id);
      fetchCampaignRules();
  }, [user?.id, isLocked]);

  const fetchCampaignRules = async () => {
      const { data: mData } = await supabase.from('matches').select('campaign_id').eq('id', matchId).single();
      let campId = mData?.campaign_id;
      
      if (!campId && league) {
          const { data: camps } = await supabase.from('campaigns').select('*').eq('is_active', true);
          const autoCamp = camps?.find(c => (c.target_leagues || []).includes(league));
          if (autoCamp) setCampaign(autoCamp);
      } else if (campId) {
          const { data: c } = await supabase.from('campaigns').select('*').eq('id', campId).single();
          if (c) setCampaign(c);
      }
  };

  const fetchPrediction = async (userId: string) => {
    const { data } = await supabase.from('user_predictions').select('*').eq('match_id', matchId).eq('user_id', userId).single();
    if (data) {
        setExistingPred(data);
        if (data.custom_predictions) {
            setFirstScorer(data.custom_predictions.first_scorer || '');
            setRedCard(data.custom_predictions.red_card || '');
            setPenalty(data.custom_predictions.penalty || '');
        }
    }
  };

  const handleSubmitMain = async () => {
    if (!outcome) {
        return alert("Please select a Winner (Home/Draw/Away)."); 
    }

    let finalHome = parseInt(scoreHome);
    let finalAway = parseInt(scoreAway);
    const requireScore = campaign ? campaign.rules?.require_score : true;

    // 🟢 SECURITY FIX: Safe NULL handling if Exact Score is optional
    if (isNaN(finalHome) || isNaN(finalAway)) {
        if (!requireScore) {
            finalHome = null as any; 
            finalAway = null as any;
        } else {
            return alert("Please predict the exact Correct Score.");
        }
    }

    if (new Date() >= new Date(matchDate)) {
        alert("⛔ Prediction Window Closed! The match has already started.");
        window.location.reload(); 
        return;
    }

    if (!user) {
        return router.push('/login');
    }
    
    setLoading(true);

    const payload = {
        match_id: matchId, 
        user_id: user.id,
        predicted_outcome: outcome, 
        predicted_home_score: finalHome, 
        predicted_away_score: finalAway,
        status: 'PENDING', 
        is_eligible_for_prize: false 
    };

    const { error } = await supabase.from('user_predictions').insert(payload);

    if (error) {
        if (error.code === '23505') { 
            alert("Prediction already locked in!"); 
            fetchPrediction(user.id); 
        } else {
            alert("Error: " + error.message);
        }
    } else {
        fetchPrediction(user.id);
    }
    
    setLoading(false);
  };

  const handleUpdateBonus = async () => {
      if (new Date() >= new Date(matchDate)) {
          return alert("⛔ Prediction Window Closed!");
      }
      
      if (!firstScorer && !redCard && !penalty) {
          return alert("Please select at least one bonus market.");
      }

      setLoading(true);
      
      const customPayload = { 
          ...existingPred?.custom_predictions, 
          first_scorer: firstScorer, 
          red_card: redCard, 
          penalty: penalty 
      };
      
      const { error } = await supabase.from('user_predictions').update({ custom_predictions: customPayload }).eq('id', existingPred.id);
      
      if (error) {
          alert("Error: " + error.message);
      } else {
          fetchPrediction(user.id);
      }
      
      setLoading(false);
  };

  const isCamp = !!campaign;
  const ptsWin = isCamp ? (campaign.rules?.points_outcome || 0) : 3;
  const ptsScore = isCamp ? (campaign.rules?.points_score || 0) : 10;
  const ptsFirstScorer = isCamp ? (campaign.rules?.points_first_scorer || 0) : 15;
  const ptsRedCard = isCamp ? (campaign.rules?.points_red_card || 0) : 5;
  const ptsPenalty = isCamp ? (campaign.rules?.points_penalty || 0) : 5;
  const requireScore = isCamp ? campaign.rules?.require_score : true;

  // Automatically parse ESPN Lineups to populate the dropdown
  const rosterOptions = useMemo(() => {
      if (!matchData?.lineups) return [];
      const homePlayers = (matchData.lineups.home || []).map((p:any) => `${p.name} (${homeTeam})`);
      const awayPlayers = (matchData.lineups.away || []).map((p:any) => `${p.name} (${awayTeam})`);
      return [...homePlayers, ...awayPlayers].sort();
  }, [matchData, homeTeam, awayTeam]);

  // 🟢 THE DOM SHIELD: If the match has started/ended, completely vanish from the page!
  if (isLocked) {
      return null;
  }

  return (
    <div className="space-y-3 relative z-10">
        
        {/* UI STATE: MAIN PREDICTION LOCKED IN */}
        {existingPred ? (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 text-center relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-400 rounded-full blur-[50px] opacity-10 pointer-events-none"></div>
                <div className="flex items-center justify-center gap-2 mb-3 relative z-10">
                    <CheckCircle className="text-green-500" size={16} />
                    <h3 className="text-green-800 font-black uppercase tracking-tighter text-sm">Main Prediction Locked</h3>
                </div>
                <div className="flex justify-center gap-2 bg-white/60 backdrop-blur-md p-2 rounded-lg shadow-sm border border-green-100 relative z-10">
                    <div className="flex-1 bg-white p-2 rounded border border-slate-100 shadow-sm">
                        <p className="text-[7px] text-slate-400 uppercase font-black tracking-widest mb-0.5">Winner</p>
                        <p className="font-black text-slate-800 uppercase text-[10px]">{existingPred.predicted_outcome}</p>
                    </div>
                    <div className="flex-1 bg-white p-2 rounded border border-slate-100 shadow-sm">
                        <p className="text-[7px] text-slate-400 uppercase font-black tracking-widest mb-0.5">Score</p>
                        <p className="font-black text-slate-800 text-[10px]">
                            {existingPred.predicted_home_score !== null ? `${existingPred.predicted_home_score} - ${existingPred.predicted_away_score}` : 'SKIPPED'}
                        </p>
                    </div>
                </div>
            </div>
        ) : (
            
        /* UI STATE: USER IS PREDICTING FOR THE FIRST TIME */
            <div className="space-y-3">
                {isCamp && (
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-3 rounded-xl shadow-md mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Zap size={16} className="text-yellow-200 fill-yellow-200" />
                            <div>
                                <h4 className="font-black text-xs uppercase tracking-widest leading-tight">{campaign.title}</h4>
                                <p className="text-[9px] font-bold text-amber-100">Special Event Active</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className={`p-2.5 rounded-xl border ${isCamp ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${isCamp ? 'text-orange-900' : 'text-slate-800'}`}>
                            <Target size={10} className={isCamp ? 'text-orange-500' : 'text-blue-500'}/> Winner
                        </h4>
                        <span className={`font-black text-[7px] px-1.5 py-0.5 rounded shadow-sm border ${isCamp ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                            {ptsWin} PTS
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-1.5">
                        <button 
                            onClick={() => setOutcome('home')} 
                            className={`py-2 rounded-lg font-black text-[9px] uppercase tracking-tight border-2 transition-all duration-300 ${outcome === 'home' ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'}`}
                        >
                            <span className="block truncate px-1">{homeTeam}</span>
                        </button>
                        <button 
                            onClick={() => setOutcome('draw')} 
                            className={`py-2 rounded-lg font-black text-[9px] uppercase tracking-widest border-2 transition-all duration-300 ${outcome === 'draw' ? 'bg-slate-800 text-white border-slate-800 shadow-md transform scale-105' : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'}`}
                        >
                            Draw
                        </button>
                        <button 
                            onClick={() => setOutcome('away')} 
                            className={`py-2 rounded-lg font-black text-[9px] uppercase tracking-tight border-2 transition-all duration-300 ${outcome === 'away' ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'}`}
                        >
                            <span className="block truncate px-1">{awayTeam}</span>
                        </button>
                    </div>
                </div>

                <div className={`p-2.5 rounded-xl border ${isCamp ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${isCamp ? 'text-orange-900' : 'text-slate-800'}`}>
                            <TrendingUp size={10} className="text-yellow-500"/> Score
                        </h4>
                        <div className="flex items-center gap-2">
                            {!requireScore && <span className="text-[7px] text-slate-400 font-bold uppercase">(Optional)</span>}
                            <span className="bg-yellow-100 text-yellow-700 font-black text-[7px] px-1.5 py-0.5 rounded shadow-sm border border-yellow-300">
                                {ptsScore} PTS
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                        <div className="text-center w-[40%]">
                            <label className="text-[8px] font-black text-slate-400 block mb-1 uppercase tracking-tight truncate">{homeTeam}</label>
                            <input 
                                type="number" 
                                min="0" 
                                max="20" 
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
                                type="number" 
                                min="0" 
                                max="20" 
                                className="w-full h-8 text-center text-lg font-black border-2 border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors" 
                                value={scoreAway} 
                                onChange={(e) => setScoreAway(e.target.value)} 
                                placeholder="-"
                            />
                        </div>
                    </div>
                </div>

                <button 
                    onClick={handleSubmitMain} 
                    disabled={loading || authLoading} 
                    className={`w-full text-white font-black uppercase tracking-widest py-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed border text-[10px] ${isCamp ? 'bg-orange-600 hover:bg-orange-500 border-orange-800' : 'bg-[#0a1428] hover:bg-blue-900 border-slate-800'}`}
                >
                    {loading ? <Loader2 className="animate-spin" size={14} /> : <><CheckCircle size={14}/> Lock In Prediction</>}
                </button>
            </div>
        )}

        {/* 🟢 THE PROGRESSIVE BONUS MARKETS */}
        {isCamp && existingPred && (
            <div className="mt-4 p-3 bg-gradient-to-br from-slate-900 to-[#0a1428] border border-slate-800 rounded-xl shadow-xl">
                <h4 className="text-[10px] font-black text-yellow-400 uppercase tracking-widest flex items-center gap-1.5 mb-3 border-b border-slate-700 pb-2">
                    <ListChecks size={12} className="text-yellow-400"/> 
                    Bonus Markets 
                    <span className="ml-auto text-[7px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded border border-yellow-500/30">
                        OPTIONAL
                    </span>
                </h4>

                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[9px] font-bold text-slate-300 uppercase flex items-center justify-between mb-1">
                                Red Card? <span className="text-green-400">+{ptsRedCard} PTS</span>
                            </label>
                            <select 
                                value={redCard} 
                                onChange={(e) => setRedCard(e.target.value)} 
                                disabled={!!existingPred?.custom_predictions?.red_card}
                                className="w-full bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-lg p-2 outline-none focus:border-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="">Select</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-slate-300 uppercase flex items-center justify-between mb-1">
                                Penalty? <span className="text-green-400">+{ptsPenalty} PTS</span>
                            </label>
                            <select 
                                value={penalty} 
                                onChange={(e) => setPenalty(e.target.value)} 
                                disabled={!!existingPred?.custom_predictions?.penalty}
                                className="w-full bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-lg p-2 outline-none focus:border-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="">Select</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                            </select>
                        </div>
                    </div>

                    {rosterOptions.length === 0 ? (
                        <div className="text-center py-3 mt-2 bg-white/5 rounded-lg border border-white/5">
                            <Users size={16} className="mx-auto text-slate-500 mb-1" />
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Goalscorer Locked</p>
                            <p className="text-[8px] text-slate-500 mt-1">Opens ~1hr before kickoff when squads are confirmed.</p>
                        </div>
                    ) : (
                        <div className="mt-2">
                            <label className="text-[9px] font-bold text-slate-300 uppercase flex items-center justify-between mb-1">
                                First Goalscorer <span className="text-green-400">+{ptsFirstScorer} PTS</span>
                            </label>
                            <select 
                                value={firstScorer} 
                                onChange={(e) => setFirstScorer(e.target.value)} 
                                disabled={!!existingPred?.custom_predictions?.first_scorer}
                                className="w-full bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-lg p-2 outline-none focus:border-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="">-- Select Player --</option>
                                {rosterOptions.map(player => <option key={player} value={player}>{player}</option>)}
                            </select>
                        </div>
                    )}

                    <button 
                        onClick={handleUpdateBonus} 
                        disabled={
                            loading || 
                            (!firstScorer && !redCard && !penalty) || 
                            (!!existingPred?.custom_predictions?.first_scorer && !!existingPred?.custom_predictions?.red_card && !!existingPred?.custom_predictions?.penalty)
                        } 
                        className="w-full mt-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase text-[10px] py-2.5 rounded-lg shadow-lg flex items-center justify-center gap-1.5 active:scale-95 transition disabled:opacity-50"
                    >
                        {loading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Update Bonus Markets
                    </button>
                </div>
            </div>
        )}
    </div>
  );
}