'use client';
import { Clock, Zap, ArrowDownUp, AlertTriangle } from 'lucide-react';

export default function MatchTimeline({ events }: { events: any[] }) {
    if (!events || events.length === 0) return null;

    return (
        <div className="w-full mt-6 mb-2">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-6 px-2">
                <Clock size={14} className="text-blue-500" /> Match Timeline
            </h4>
            
            <div className="relative w-full py-4">
                {/* The Center Vertical Line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-slate-200 -translate-x-1/2 rounded-full"></div>

                <div className="flex flex-col gap-6">
                    {events.map((e, i) => {
                        const isHome = e.team === 'home';
                        const isNeutral = !e.team || e.team === '';
                        
                        // Decide Icon and Colors
                        let Icon = Zap;
                        let iconColor = "bg-slate-100 text-slate-500";
                        if (e.type === 'goal') { Icon = Zap; iconColor = "bg-yellow-400 text-white shadow-[0_0_10px_rgba(250,204,21,0.6)]"; }
                        if (e.type === 'card') { Icon = AlertTriangle; iconColor = "bg-yellow-400 text-white"; }
                        if (e.type === 'red-card') { Icon = AlertTriangle; iconColor = "bg-red-600 text-white"; }
                        if (e.type === 'sub') { Icon = ArrowDownUp; iconColor = "bg-blue-500 text-white"; }
                        if (e.type === 'var_overturn') { Icon = Clock; iconColor = "bg-slate-800 text-white"; }

                        return (
                            <div key={e.id || i} className={`relative flex items-center w-full ${isHome ? 'justify-start' : isNeutral ? 'justify-center' : 'justify-end'} group`}>
                                
                                {/* Timeline Node (The Circle in the middle) */}
                                <div className="absolute left-1/2 -translate-x-1/2 w-6 h-6 md:w-8 md:h-8 rounded-full border-[3px] border-white flex items-center justify-center z-10 transition-transform group-hover:scale-110" style={{ backgroundColor: isHome ? '#2563eb' : isNeutral ? '#94a3b8' : '#dc2626' }}>
                                    <span className="text-[8px] md:text-[9px] font-black text-white">{e.time?.replace("'", "") || "0"}</span>
                                </div>

                                {/* The Content Box */}
                                {!isNeutral && (
                                    <div className={`w-[45%] flex ${isHome ? 'justify-end pr-5 md:pr-8' : 'justify-start pl-5 md:pl-8'}`}>
                                        <div className={`flex items-center gap-2 md:gap-3 max-w-full ${isHome ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}>
                                            <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${iconColor}`}>
                                                <Icon size={12} strokeWidth={3}/>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] md:text-xs font-black text-slate-800 leading-tight">{e.player}</span>
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{e.text}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {isNeutral && (
                                    <div className="bg-slate-800 text-white text-[9px] font-bold px-3 py-1 rounded-full shadow-md z-20 mt-8">
                                        {e.text}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}