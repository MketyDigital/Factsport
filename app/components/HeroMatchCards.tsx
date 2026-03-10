'use client';
import Link from "next/link";
import { Video, Radio } from "lucide-react";
import MatchTime from '@/app/components/MatchTime';

export default function HeroMatchCards({ heroMatches }: { heroMatches: any[] }) {
    if (!heroMatches || heroMatches.length === 0) return null;

    return (
        <div className="px-4 mb-5 flex gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x">
             {heroMatches.map((match) => {
                
                const widthClass = heroMatches.length === 1 
                    ? 'w-full' 
                    : heroMatches.length === 2 
                        ? 'w-[48%] md:w-[48%]' 
                        : 'w-[42%] md:w-[30%]';

                return (
                    <Link 
                        key={match.id} 
                        href={`/match/${match.id}`} 
                        className={`block relative z-10 snap-center shrink-0 ${widthClass}`}
                    >
                        <div className="bg-[#0a1428] rounded-xl p-2.5 md:p-4 shadow-xl border border-slate-700 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                            
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[7px] md:text-[8px] font-black px-3 py-[2px] rounded-b-sm z-20 uppercase tracking-widest shadow-md whitespace-nowrap">
                                Top Match
                            </div>

                            {match.home_fanart || match.home_stadium ? (
                                <>
                                    <img src={match.home_fanart || match.home_stadium} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 group-hover:scale-105 transition duration-700 ease-out mix-blend-overlay" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a1428] via-[#0a1428]/60 to-transparent"></div>
                                </>
                            ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-[#0a1428] opacity-80"></div>
                            )}

                            <div className="relative z-10">
                                {['LIVE','HT','IN_PLAY'].includes(match.status) && (
                                    <div className="absolute top-0 right-0 bg-red-600 text-white text-[7px] font-black px-2 py-0.5 rounded-bl-md animate-pulse flex items-center gap-1 shadow-lg">
                                        <span className="w-1 h-1 bg-white rounded-full"></span> LIVE
                                    </div>
                                )}
                                {(match.livestream_url || match.audio_url) && (
                                    <div className="absolute top-0 left-0 bg-black/60 backdrop-blur-md text-white text-[7px] font-bold px-2 py-0.5 rounded-br-md border border-white/10 flex items-center gap-1">
                                         {match.livestream_url ? <Video size={8} className="text-red-500" /> : <Radio size={8} className="text-blue-400" />}
                                         {match.livestream_url ? 'WATCH' : 'AUDIO'}
                                    </div>
                                )}
                                
                                <div className="flex justify-between items-center mt-5 md:mt-6">
                                    {/* HOME TEAM - Given 28% width */}
                                    <div className="flex flex-col items-center w-[28%]">
                                        {match.home_logo ? <img src={match.home_logo} className="w-7 h-7 md:w-12 md:h-12 object-contain mb-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"/> : <div className="w-7 h-7 bg-white/10 rounded-full mb-1.5 flex items-center justify-center text-[9px] font-bold text-white">H</div>}
                                        <span className="text-[8px] md:text-[10px] font-bold text-center leading-tight text-white line-clamp-1 drop-shadow-md w-full px-0.5">{match.home_team}</span>
                                    </div>
                                    
                                    {/* SCORE & TIME - Given 44% width to ensure it never cuts off */}
                                    <div className="flex flex-col items-center justify-center w-[44%] px-0.5">
                                        <div className="text-xs md:text-2xl font-black tabular-nums tracking-wider bg-black/50 px-1.5 py-0.5 md:px-3 md:py-1 rounded-md md:rounded-xl backdrop-blur-md border border-white/10 shadow-inner text-white whitespace-nowrap flex items-center justify-center min-w-[30px]">
                                            {match.status === 'SCHEDULED' || match.status === 'PRE' ? <span className="text-[9px] md:text-sm opacity-60">VS</span> : `${match.home_score}-${match.away_score}`}
                                        </div>
                                        <div className="mt-1 w-full flex justify-center">
                                            <span className="text-[6px] md:text-[9px] font-black text-blue-300 uppercase tracking-normal md:tracking-widest text-center drop-shadow-md bg-blue-900/30 px-1 py-0.5 rounded whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                                                {match.status === 'SCHEDULED' || match.status === 'PRE' 
                                                    ? <MatchTime date={match.match_date} />
                                                    : (match.status === 'HT' ? 'HT' : match.status)
                                                }
                                            </span>
                                        </div>
                                    </div>

                                    {/* AWAY TEAM - Given 28% width */}
                                    <div className="flex flex-col items-center w-[28%]">
                                        {match.away_logo ? <img src={match.away_logo} className="w-7 h-7 md:w-12 md:h-12 object-contain mb-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"/> : <div className="w-7 h-7 bg-white/10 rounded-full mb-1.5 flex items-center justify-center text-[9px] font-bold text-white">A</div>}
                                        <span className="text-[8px] md:text-[10px] font-bold text-center leading-tight text-white line-clamp-1 drop-shadow-md w-full px-0.5">{match.away_team}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Link>
                );
             })}
         </div>
    );
}