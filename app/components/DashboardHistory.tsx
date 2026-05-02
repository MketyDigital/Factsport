'use client';
import { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, ExternalLink, Minus, Trophy, ArrowRight, Target, Gamepad2, ChevronLeft, ChevronRight, Zap, ListChecks } from 'lucide-react';

export default function DashboardHistory({ predictions, pastWins }: { predictions: any[], pastWins: any[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const hasCurrentData = predictions && predictions.length > 0;
  const hasPastWins = pastWins && pastWins.length > 0;
  
  const displayList = hasCurrentData ? predictions : pastWins;
  const isPastWinsView = !hasCurrentData && hasPastWins;
  
  const totalPages = Math.ceil((displayList?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = displayList?.slice(startIndex, startIndex + itemsPerPage) || [];

  return (
    <div className="px-4">
        <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <TrendingUp size={14} /> {isPastWinsView ? 'Recent Victories' : 'Activity History'}
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
                        {hasPastWins ? "You've won before, let's do it again! Place your first prediction for this month." : "New month, new opportunities! Make your first prediction to climb the leaderboard."}
                    </p>
                    <Link href="/matches" className="inline-flex items-center gap-2 bg-yellow-400 text-blue-900 px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-yellow-300 transition shadow-md active:scale-95">
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
                            <Trophy size={12} /> Displaying your last winning predictions
                        </p>
                    </div>
                )}

                <div className="divide-y divide-slate-50">
                    {paginatedData.map((pred: any) => {
                        const isFT = pred.match?.status === 'FT' || pred.match?.status === 'LIVE' || (pred.match?.home_score !== null);
                        const events = pred.match?.match_events || [];
                        const actualFirstScorer = events.find((e:any) => e.type === 'goal')?.player || 'None';
                        const actualRedCard = events.some((e:any) => e.type === 'red-card') ? 'Yes' : 'No';
                        const actualPenalty = events.some((e:any) => e.type === 'penalty_awarded') ? 'Yes' : 'No';
                        
                        const cp = pred.custom_predictions || {};
                        const hasBonus = cp.first_scorer || cp.red_card || cp.penalty;

                        const mthPts = pred.points_awarded || 0;
                        const campPts = pred.campaign_points_awarded || 0;
                        const totalEarned = mthPts + campPts;
                        const isPending = pred.status?.toLowerCase() === 'pending';

                        // 🟢 LOGIC: 3-WAY LABEL CHECK
                        const isEligible = pred.is_eligible_for_prize;
                        const isCampaign = !!pred.campaign?.title;
                        const isForFun = !isEligible && !isCampaign;

                        return (
                            <div key={pred.id} className="p-4 flex flex-col hover:bg-slate-50 transition">
                                <div className="flex justify-between items-start w-full">
                                    <div>
                                        <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                                            {pred.match ? <>{pred.match.home_team} <span className="text-slate-300 text-[10px] font-normal">vs</span> {pred.match.away_team}</> : <span className="text-slate-400 italic">Match Data Unavailable</span>}
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div>
                                                <span className="text-[9px] text-slate-400 font-bold uppercase block mb-0.5">Your Pick</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase">{pred.predicted_outcome}</span>
                                                    <span className="text-[10px] font-black text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{pred.predicted_home_score !== null ? `${pred.predicted_home_score} - ${pred.predicted_away_score}` : 'OPTIONAL'}</span>
                                                </div>
                                            </div>
                                            
                                            {isFT && <Minus size={12} className="text-slate-300 rotate-90" />}
                                            
                                            {isFT ? (
                                                <div>
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase block mb-0.5">Result</span>
                                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${mthPts === 10 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-slate-900 border-slate-200'}`}>{pred.match?.home_score} - {pred.match?.away_score}</span>
                                                </div>
                                            ) : (
                                                <div>
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase block mb-0.5">Status</span>
                                                    <span className="text-[9px] font-medium text-slate-500 italic">{pred.match?.status === 'SCHEDULED' ? 'Upcoming' : pred.match?.status}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-right pl-2 flex flex-col items-end">
                                        {isPending ? (
                                            <span className="text-[9px] font-black text-yellow-600 bg-yellow-50 px-2 py-1 rounded border border-yellow-100">PENDING</span>
                                        ) : (
                                            <div className="flex flex-col gap-1 items-end">
                                                {totalEarned === 0 ? (
                                                    <span className="text-[9px] font-black px-2 py-0.5 rounded border bg-red-50 text-red-500 border-red-100">LOST</span>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        {mthPts > 0 && (
                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${isEligible ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                                                <Trophy size={8}/> {isEligible ? 'MTH:' : 'FUN:'} +{mthPts}
                                                            </span>
                                                        )}
                                                        {campPts > 0 && (
                                                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-200 flex items-center gap-0.5">
                                                                <Zap size={8}/> CMP: +{campPts}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        
                                        {pred.campaign?.title && <div className="text-[7px] font-black text-orange-400 uppercase mt-1 line-clamp-1 max-w-[80px] text-right">{pred.campaign.title}</div>}
                                        
                                        <div className="flex justify-end mt-1.5 flex-wrap gap-1">
                                            {isEligible && (
                                                <span className="flex items-center gap-1 text-[7px] font-bold text-green-600 bg-green-50 px-1 py-0.5 rounded border border-green-100" title="Counts towards your Monthly Prizes">
                                                    <Target size={8} /> MTH ELIGIBLE
                                                </span>
                                            )}
                                            {isCampaign && (
                                                <span className="flex items-center gap-1 text-[7px] font-bold text-orange-600 bg-orange-50 px-1 py-0.5 rounded border border-orange-100" title="Tournament Match Entry">
                                                    <Zap size={8} /> CAMP ENTRY
                                                </span>
                                            )}
                                            {isForFun && (
                                                <span className="flex items-center gap-1 text-[7px] font-bold text-slate-500 bg-slate-100 px-1 py-0.5 rounded border border-slate-200" title="Daily limit reached. Fun points awarded.">
                                                    <Gamepad2 size={8} /> FOR FUN
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 🟢 BONUS MARKETS DISPLAY */}
                                {hasBonus && (
                                    <div className="mt-3 bg-slate-800 rounded-lg p-2.5 w-full text-[9px] text-slate-300">
                                        <h5 className="font-bold text-yellow-400 uppercase mb-1.5 border-b border-slate-700 pb-1 flex items-center gap-1"><ListChecks size={10}/> Bonus Market Predictions</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                            {cp.first_scorer && (
                                                <div>
                                                    <span className="text-slate-500">Scorer:</span> <span className="font-black text-white">{cp.first_scorer}</span> 
                                                    {isFT && <span className="ml-1 text-[8px]">{cp.first_scorer === actualFirstScorer ? '✅' : `❌ (Was: ${actualFirstScorer})`}</span>}
                                                </div>
                                            )}
                                            {cp.red_card && (
                                                <div>
                                                    <span className="text-slate-500">Red Card:</span> <span className="font-black text-white">{cp.red_card}</span> 
                                                    {isFT && <span className="ml-1 text-[8px]">{cp.red_card === actualRedCard ? '✅' : '❌'}</span>}
                                                </div>
                                            )}
                                            {cp.penalty && (
                                                <div>
                                                    <span className="text-slate-500">Penalty:</span> <span className="font-black text-white">{cp.penalty}</span> 
                                                    {isFT && <span className="ml-1 text-[8px]">{cp.penalty === actualPenalty ? '✅' : '❌'}</span>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* 🟢 STRICT PAGINATION CONTROLS */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between bg-slate-50 p-3 border-t border-slate-100">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 bg-white border border-slate-200 rounded text-slate-600 disabled:opacity-30 active:scale-95 transition shadow-sm">
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 bg-white border border-slate-200 rounded text-slate-600 disabled:opacity-30 active:scale-95 transition shadow-sm">
                            <ChevronRight size={16} />
                        </button>
                    </div>
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