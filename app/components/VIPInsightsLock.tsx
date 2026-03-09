'use client';
import Link from 'next/link';
import { Lock, Sparkles, Target } from 'lucide-react';

// You would pass the actual H2H stats (like totalGoals, numberOfMatches) into this component
export default function VIPInsightsLock({ isVIP, h2hData }: { isVIP: boolean, h2hData: any }) {
    
    // Simulate AI math based on history
    const avgGoals = h2hData?.numberOfMatches > 0 ? (h2hData.totalGoals / h2hData.numberOfMatches).toFixed(1) : "2.5";
    
    if (isVIP) {
        return (
            <div className="bg-gradient-to-br from-slate-900 to-[#0a1428] rounded-2xl p-5 shadow-xl border border-yellow-500/30">
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="text-yellow-500" size={16}/>
                    <h3 className="text-yellow-500 font-black uppercase tracking-widest text-xs">VIP AI Insight</h3>
                </div>
                <div className="space-y-3">
                    <div className="bg-white/10 p-3 rounded-lg border border-white/5">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Over/Under Prediction</span>
                        <span className="text-white font-black">OVER 2.5 GOALS</span>
                        <p className="text-[9px] text-slate-400 mt-1">Historically, these teams average {avgGoals} goals per match.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl p-5 shadow-md border border-slate-200 relative overflow-hidden group">
            {/* Blurred Fake Content */}
            <div className="filter blur-[6px] opacity-40 pointer-events-none select-none">
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="text-slate-400" size={16}/>
                    <h3 className="text-slate-800 font-black uppercase tracking-widest text-xs">VIP AI Insight</h3>
                </div>
                <div className="bg-slate-100 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Over/Under Prediction</span>
                    <span className="text-slate-800 font-black">OVER 2.5 GOALS</span>
                </div>
            </div>

            {/* Premium Lock Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm z-10">
                <div className="bg-yellow-500 w-12 h-12 rounded-full flex items-center justify-center shadow-lg mb-3">
                    <Lock className="text-black" size={20}/>
                </div>
                <h4 className="font-black text-slate-900 uppercase tracking-widest text-sm mb-1">Pro Analysis Locked</h4>
                <p className="text-[10px] text-slate-600 font-bold mb-4 text-center max-w-[200px]">Unlock AI-driven betting insights and historical trends.</p>
                <Link href="/vip/upgrade" className="bg-[#0a1428] text-white px-6 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-md hover:bg-blue-900 transition active:scale-95">
                    Upgrade to VIP
                </Link>
            </div>
        </div>
    );
}