'use client';
import { useState } from 'react';
import { MessageCircle, BarChart2, Zap, History, BrainCircuit } from 'lucide-react';
import FanZoneChat from '@/app/components/FanZoneChat';
import StatsLineupsTabs from '@/app/components/StatsLineupsTabs';
import ProBettingSlipLock from '@/app/components/ProBettingSlipLock';
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';

export default function MatchMobileHub({ matchId, espnId, currentUser, initialData, dbData }: any) {
    const [activeTab, setActiveTab] = useState<'chat' | 'stats' | 'pro'>('chat');

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            const y = element.getBoundingClientRect().top + window.scrollY - 60; 
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    };

    return (
        <div className="w-full flex flex-col bg-white shadow-md md:rounded-2xl overflow-hidden mb-4 border border-slate-200">
            
            <div className="flex overflow-x-auto scrollbar-hide border-b border-slate-200 bg-white sticky top-0 z-40 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
                <button onClick={() => setActiveTab('chat')} className={`flex-1 py-3 px-3 min-w-max text-[10px] md:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${activeTab === 'chat' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <MessageCircle size={14} className={activeTab === 'chat' ? 'fill-blue-100' : ''}/> Live Chat
                </button>
                <button onClick={() => setActiveTab('stats')} className={`flex-1 py-3 px-3 min-w-max text-[10px] md:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${activeTab === 'stats' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <BarChart2 size={14} /> Stats & XI
                </button>
                <button onClick={() => setActiveTab('pro')} className={`flex-1 py-3 px-3 min-w-max text-[10px] md:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${activeTab === 'pro' ? 'text-yellow-600 border-b-2 border-yellow-500 bg-yellow-50/30' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <BrainCircuit size={14} className={activeTab === 'pro' ? 'text-yellow-500' : ''}/> Pro Slip
                </button>
                
                <button onClick={() => scrollToSection('predictions')} className="flex-1 py-3 px-4 min-w-max text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1.5 border-l border-slate-100">
                    <Zap size={12} /> Predict
                </button>
            </div>

            <div className="bg-[#F0F2F5] relative">
                
                {/* 🟢 GLOBAL ADSTERRA BANNER (Visible across all tabs) */}
                <div className="w-full bg-white border-b border-slate-200 py-1 sticky top-[46px] z-30">
                    <AdsterraStandardBanner />
                </div>

                {/* Tab Content */}
                {activeTab === 'chat' && <FanZoneChat matchId={matchId} espnId={espnId} />}
                {activeTab === 'stats' && <div className="p-2 md:p-4 bg-white"><StatsLineupsTabs matchId={matchId} initialData={initialData} /></div>}
                {activeTab === 'pro' && <div className="p-3 md:p-6 bg-slate-900"><ProBettingSlipLock homeTeam={dbData.home_team} awayTeam={dbData.away_team} status={dbData.status} proAnalysis={dbData.pro_analysis} /></div>}
            </div>
        </div>
    );
}