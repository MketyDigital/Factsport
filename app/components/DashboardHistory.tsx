'use client';
import { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, ExternalLink, Minus, ChevronDown, Trophy, ArrowRight, Target, Gamepad2 } from 'lucide-react';

export default function DashboardHistory({ predictions, pastWins }: { predictions: any[], pastWins: any[] }) {
  const [visibleCount, setVisibleCount] = useState(10);

  const hasCurrentData = predictions && predictions.length > 0;
  const hasPastWins = pastWins && pastWins.length > 0;
  
  const displayList = hasCurrentData ? predictions : pastWins;
  const isPastWinsView = !hasCurrentData && hasPastWins;

  const showMore = () => {
    setVisibleCount((prev) => prev + 10);
  };

  return (
    <div className="px-4">
        <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <TrendingUp size={14} /> {isPastWinsView ? 'Recent Victories' : 'Monthly Activity'}
            </h3>
            <Link href="/leaderboard" className="text-[10px] font-bold text-blue-600 flex items-center gap-1">
                View Leaderboard <ExternalLink size={10} />
            </Link>
        </div>

        {!hasCurrentData && (
             <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-5 mb-4 text-white shadow-lg relative overflow-hidden">
                <div className="absolute right-0 bottom-0 opacity-10"><Trophy size={100} /></div>
                <div className="relative z-10">
                    <h4 className="font-black text-lg italic uppercase">Start Winning!</h4>
                    <p className="text-blue-100 text-xs mb-3 max-w-[200px]">
                        {hasPastWins 
                           ? "You've won before, let's do it again! Place your first prediction for this month."
                           : "New month, new opportunities! Make your first prediction to climb the leaderboard."}
                    </p>
                    <Link href="/" className="inline-flex items-center gap-2 bg-yellow-400 text-blue-900 px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-yellow-300 transition shadow-md active:scale-95">
                        Predict Matches <ArrowRight size={14} />
                    </Link>
                </div>
             </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[100px]">
            {displayList && displayList.length > 0 ? (
                <>
                {isPastWinsView && (
                    <div className="bg-yellow-50 px-4 py-2 border-b border-yellow-100">
                        <p className="text-[10px] font-bold text-yellow-700 flex items-center gap-1">
                            <Trophy size={12} /> Displaying your last 5 winning tickets
                        </p>
                    </div>
                )}

                <div className="divide-y divide-slate-50">
                    {displayList.slice(0, visibleCount).map((pred: any) => {
                        const hasRealScore = pred.match?.status === 'FT' || pred.match?.status === 'LIVE' || (pred.match?.home_score !== null);
                        
                        return (
                            <div key={pred.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition">
                                <div>
                                    <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                                        {pred.match ? (
                                            <>{pred.match.home_team} <span className="text-slate-300 text-[10px] font-normal">vs</span> {pred.match.away_team}</>
                                        ) : <span className="text-slate-400 italic">Match Data Unavailable</span>}
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase block mb-0.5">Your Pick</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase">
                                                    {pred.predicted_outcome}
                                                </span>
                                                <span className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                    {pred.predicted_home_score} - {pred.predicted_away_score}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {hasRealScore && <Minus size={12} className="text-slate-300 rotate-90" />}

                                        {hasRealScore ? (
                                            <div>
                                                <span className="text-[9px] text-slate-400 font-bold uppercase block mb-0.5">Result</span>
                                                <span className={`text-xs font-black px-2 py-1 rounded border ${
                                                    pred.points_awarded === 10 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-slate-900 border-slate-200'
                                                }`}>
                                                    {pred.match?.home_score} - {pred.match?.away_score}
                                                </span>
                                            </div>
                                        ) : (
                                            <div>
                                                <span className="text-[9px] text-slate-400 font-bold uppercase block mb-0.5">Status</span>
                                                <span className="text-[10px] font-medium text-slate-500 italic">
                                                    {pred.match?.status === 'SCHEDULED' ? 'Upcoming' : pred.match?.status}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="text-right pl-2">
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
                                    <div className="text-[9px] text-slate-300 mt-2 font-medium mb-1">{new Date(pred.created_at).toLocaleDateString()}</div>
                                    
                                    <div className="flex justify-end mt-1">
                                        {pred.is_eligible_for_prize ? (
                                            <span className="flex items-center gap-1 text-[8px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100" title="Counts towards monthly prize!">
                                                <Target size={8} /> ELIGIBLE
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[8px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200" title="Over daily limit. Just for fun points.">
                                                <Gamepad2 size={8} /> FOR FUN
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {visibleCount < displayList.length && (
                    <button 
                        onClick={showMore}
                        className="w-full py-3 bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-100 transition flex items-center justify-center gap-1 border-t border-slate-100"
                    >
                        Show Older History <ChevronDown size={12} />
                    </button>
                )}
                </>
            ) : (
                 <div className="flex flex-col items-center justify-center py-8 text-center opacity-50">
                    <p className="text-xs font-bold text-slate-400">History is empty</p>
                </div>
            )}
        </div>
    </div>
  );
}