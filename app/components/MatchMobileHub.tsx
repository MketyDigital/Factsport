'use client';
import { useState } from 'react';
import { MessageCircle, BarChart2, Zap, History } from 'lucide-react';
import FanZoneChat from '@/app/components/FanZoneChat';
import StatsLineupsTabs from '@/app/components/StatsLineupsTabs';
import PredictionBoard from '@/app/components/PredictionBoard';
import HeadToHeadStats from '@/app/components/HeadToHeadStats';

export default function MatchMobileHub({ 
    matchId, 
    espnId, 
    currentUser, 
    initialData, 
    dbData 
}: { 
    matchId: string, 
    espnId: string, 
    currentUser: any, 
    initialData: any, 
    dbData: any 
}) {
    const [activeTab, setActiveTab] = useState<'chat' | 'stats' | 'predict' | 'h2h'>('chat');

    return (
        <div className="w-full flex flex-col bg-white shadow-xl md:rounded-2xl overflow-hidden mb-6">
            
            {/* The Compact Tab Menu */}
            <div className="flex overflow-x-auto scrollbar-hide border-b border-slate-200 bg-slate-50 sticky top-[52px] md:top-[60px] z-30">
                <button onClick={() => setActiveTab('chat')} className={`flex-1 py-3 px-4 min-w-max text-[10px] md:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'chat' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                    <MessageCircle size={14} className={activeTab === 'chat' ? 'fill-blue-100' : ''}/> Fan Zone
                </button>
                <button onClick={() => setActiveTab('stats')} className={`flex-1 py-3 px-4 min-w-max text-[10px] md:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'stats' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                    <BarChart2 size={14} /> Stats & XI
                </button>
                <button onClick={() => setActiveTab('predict')} className={`flex-1 py-3 px-4 min-w-max text-[10px] md:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'predict' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                    <Zap size={14} className={activeTab === 'predict' ? 'fill-blue-100 text-blue-600' : 'text-yellow-500'}/> Predict
                </button>
                <button onClick={() => setActiveTab('h2h')} className={`flex-1 py-3 px-4 min-w-max text-[10px] md:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'h2h' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                    <History size={14} /> H2H
                </button>
            </div>

            {/* The Content Area */}
            <div className="bg-[#F0F2F5]">
                {activeTab === 'chat' && (
                    <FanZoneChat matchId={matchId} espnId={espnId} user={currentUser} />
                )}
                {activeTab === 'stats' && (
                    <div className="p-2 md:p-4">
                        <StatsLineupsTabs matchId={matchId} initialData={initialData} />
                    </div>
                )}
                {activeTab === 'predict' && (
                    <div className="p-2 md:p-4">
                        <div className="bg-white rounded-xl shadow-sm p-3 border border-slate-200">
                            <PredictionBoard matchId={matchId} matchDate={dbData.match_date} homeTeam={dbData.home_team} awayTeam={dbData.away_team} />
                        </div>
                    </div>
                )}
                {activeTab === 'h2h' && (
                    <div className="p-2 md:p-4">
                        <HeadToHeadStats dbData={initialData} />
                    </div>
                )}
            </div>
        </div>
    );
}