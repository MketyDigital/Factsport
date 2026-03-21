'use client';
import { PieChart, Percent } from 'lucide-react';

export default function WinProbability({ predictor, homeTeam, awayTeam }: any) {
    if (!predictor || (!predictor.home && !predictor.away)) return null;

    const home = parseFloat(predictor.home).toFixed(1);
    const away = parseFloat(predictor.away).toFixed(1);
    const draw = parseFloat(predictor.draw).toFixed(1);

    return (
        <div className="w-full bg-white p-4 md:p-5 border-b border-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                    <PieChart size={14} className="text-blue-500" /> Win Probability
                </h4>
                <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                    <Percent size={10}/> AI Powered
                </span>
            </div>

            {/* The 3-Way Tug-of-War Bar */}
            <div className="w-full h-3 md:h-4 rounded-full flex overflow-hidden shadow-inner mb-3 bg-slate-100">
                <div style={{ width: `${home}%` }} className="h-full bg-blue-600 transition-all duration-1000 ease-out"></div>
                <div style={{ width: `${draw}%` }} className="h-full bg-slate-300 transition-all duration-1000 ease-out"></div>
                <div style={{ width: `${away}%` }} className="h-full bg-red-500 transition-all duration-1000 ease-out"></div>
            </div>

            {/* The Labels */}
            <div className="flex justify-between items-center text-[10px] md:text-xs">
                <div className="flex flex-col items-start w-[33%]">
                    <span className="font-black text-blue-700 text-sm md:text-base">{home}%</span>
                    <span className="font-bold text-slate-500 uppercase tracking-widest text-[8px] truncate w-full">{homeTeam}</span>
                </div>
                <div className="flex flex-col items-center w-[33%] text-center">
                    <span className="font-black text-slate-600 text-sm md:text-base">{draw}%</span>
                    <span className="font-bold text-slate-400 uppercase tracking-widest text-[8px]">Draw</span>
                </div>
                <div className="flex flex-col items-end w-[33%] text-right">
                    <span className="font-black text-red-600 text-sm md:text-base">{away}%</span>
                    <span className="font-bold text-slate-500 uppercase tracking-widest text-[8px] truncate w-full">{awayTeam}</span>
                </div>
            </div>
        </div>
    );
}