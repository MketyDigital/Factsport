'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase/client'; // 🟢 FIXED: Using your configured browser client to read the secure cookies!
import { Lock, Sparkles, Send, ShieldCheck, BrainCircuit, ExternalLink, Target, Shield, Loader2 } from 'lucide-react';

interface ProBettingSlipProps {
    homeTeam: string;
    awayTeam: string;
    status?: string;
    proAnalysis?: any;
}

export default function ProBettingSlipLock({ homeTeam, awayTeam, status = 'SCHEDULED', proAnalysis }: ProBettingSlipProps) {
    const [isVIP, setIsVIP] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkVipStatus = async () => {
            try {
                // 🟢 FIXED: It now knows exactly how to read your login session
                const supabase = createClient();

                const { data: { session } } = await supabase.auth.getSession();
                
                if (session?.user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('is_vip')
                        .eq('id', session.user.id)
                        .single();
                        
                    if (profile?.is_vip) {
                        setIsVIP(true);
                    }
                }
            } catch (error) {
                console.error("Auth check failed:", error);
            } finally {
                setIsLoading(false);
            }
        };

        checkVipStatus();
    }, []);
    
    const currentStatus = status?.toUpperCase() || '';
    const isScheduled = ['SCHEDULED', 'PRE'].includes(currentStatus);
    const isFinished = ['FT', 'FINISHED', 'AET', 'PEN', 'ABD'].includes(currentStatus);

    if (!proAnalysis || Object.keys(proAnalysis).length === 0) {
        if (isScheduled) {
            return (
                <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm flex flex-col items-center justify-center">
                    <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center shadow-inner border border-blue-100 mb-2 relative">
                        <BrainCircuit className="text-blue-500 relative z-10" size={14} />
                    </div>
                    <h4 className="text-slate-800 font-black uppercase tracking-widest text-[9px] mb-0.5">AI Analysis Pending</h4>
                    <p className="text-[8px] font-bold text-slate-500 max-w-[200px] leading-snug">
                        Gathering tactical squad data.
                    </p>
                </div>
            );
        }
        return null; 
    }

    return (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
            
            <div className="bg-gradient-to-r from-slate-900 to-[#0a1428] p-2 flex justify-between items-center border-b border-slate-800">
                <div className="flex items-center gap-1.5">
                    <BrainCircuit className="text-yellow-500" size={12}/>
                    <h3 className="text-white font-black uppercase tracking-widest text-[9px]">
                        Verified AI Analysis
                    </h3>
                </div>
                <div className="flex items-center gap-1 bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded text-[7px] font-bold border border-green-500/30">
                    <ShieldCheck className="w-2.5 h-2.5" /> 92% Edge
                </div>
            </div>

            <div className="p-2.5 relative group bg-slate-50/50">
                <div className={`space-y-2 transition-all duration-300 ${!isVIP ? 'filter blur-[4px] opacity-40 select-none pointer-events-none' : ''}`}>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        <div className="bg-white border border-blue-200 rounded-md p-2 shadow-sm relative overflow-hidden flex justify-between items-center">
                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                            <div className="pl-1.5">
                                <span className="text-[7px] text-blue-600 font-black uppercase tracking-widest flex items-center gap-1 mb-0.5"><Target size={8}/> Value Play</span>
                                <span className="text-[10px] md:text-xs font-black text-slate-800 leading-tight">{proAnalysis.primary}</span>
                            </div>
                            <span className="text-sm md:text-base font-black text-blue-600 tabular-nums">{proAnalysis.odds}</span>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-md p-2 shadow-sm relative overflow-hidden flex justify-between items-center">
                            <div className="absolute top-0 left-0 w-1 h-full bg-slate-400"></div>
                            <div className="pl-1.5">
                                <span className="text-[7px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1 mb-0.5"><Shield size={8}/> Safe Builder</span>
                                <span className="text-[9px] md:text-[10px] font-bold text-slate-700 leading-tight">{proAnalysis.safe}</span>
                            </div>
                            <span className="text-xs md:text-sm font-black text-slate-500 tabular-nums">{proAnalysis.safeOdds}</span>
                        </div>
                    </div>

                    <div className="bg-blue-50/50 border border-blue-100 rounded-md p-2 shadow-inner">
                        <span className="text-[8px] text-blue-500 font-black uppercase tracking-widest mb-1 flex items-center gap-1"><Sparkles size={8}/> Tactical Rationale</span>
                        <p className="text-[9px] text-slate-700 font-medium leading-snug">
                            {proAnalysis.rationale} {isFinished ? " 🔒 Archived Match." : ""}
                        </p>
                    </div>
                    
                    <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[7px] font-bold text-slate-500 bg-white border border-slate-200 px-1 py-0.5 rounded shadow-sm">Code: <span className="font-black text-black">FACTSPORT</span></span>
                            <div className="flex gap-1">
                                <a href="https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599" target="_blank" rel="noopener noreferrer" className="text-[7px] bg-[#1A1A1A] hover:bg-black text-white px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold transition shadow-sm">1xBet <ExternalLink size={6}/></a>
                                <a href="https://refpa54566.com/L?tag=d_1181253m_45415c_&site=1181253&ad=45415" target="_blank" rel="noopener noreferrer" className="text-[7px] bg-yellow-500 hover:bg-yellow-400 text-black px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold transition shadow-sm">Melbet <ExternalLink size={6}/></a>
                            </div>
                        </div>
                    </div>
                </div>

                {!isVIP && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[3px] z-10 p-2">
                        {isLoading ? (
                            <>
                                <Loader2 className="w-8 h-8 text-yellow-500 animate-spin mb-2" />
                                <h4 className="font-black text-slate-900 uppercase tracking-tighter text-xs mb-0.5">Verifying Access...</h4>
                            </>
                        ) : (
                            <>
                                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center shadow-md mb-1.5"><Lock className="w-3.5 h-3.5 text-black" /></div>
                                <h4 className="font-black text-slate-900 uppercase tracking-tighter text-xs mb-0.5">Pro Analysis Locked</h4>
                                <p className="text-[8px] text-slate-700 font-bold mb-2 text-center max-w-[200px] leading-tight">Unlock primary bet & tactical data.</p>
                                <div className="flex flex-row gap-1.5 w-full max-w-[240px]">
                                    <Link href="/vip/upgrade" className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black py-1.5 rounded text-[8px] font-black uppercase tracking-widest shadow-sm flex items-center justify-center gap-1"><Lock size={10} /> Unlock</Link>
                                    <a href="https://t.me/factsportlive" target="_blank" rel="noopener noreferrer" className="flex-1 bg-[#229ED9] text-white py-1.5 rounded text-[8px] font-black uppercase tracking-widest shadow-sm flex items-center justify-center gap-1"><Send size={10} /> Telegram</a>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}