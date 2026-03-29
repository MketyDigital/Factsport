'use client';
import Link from 'next/link';
import { Zap, ChevronRight } from 'lucide-react';

export default function FreeTipsBanner() {
    return (
        <Link href="/vip/upgrade" className="bg-gradient-to-r from-blue-700 to-blue-900 rounded-lg p-2.5 flex items-center justify-between shadow-sm hover:shadow-md transition active:scale-[0.98] group border border-blue-500/30">
            <div className="flex items-center gap-2 md:gap-3">
                <div className="bg-yellow-400 p-1.5 rounded-md shadow-sm">
                    <Zap size={14} className="text-black fill-black" />
                </div>
                <div>
                    <h4 className="text-white font-black text-[10px] md:text-xs uppercase tracking-widest leading-none">Free Pro Tips</h4>
                    <p className="text-blue-200 text-[8px] md:text-[9px] font-bold mt-0.5">Unlock today's high-value predictions</p>
                </div>
            </div>
            <div className="bg-white/10 text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md group-hover:bg-white/20 transition flex items-center gap-1 border border-white/10">
                View <ChevronRight size={10} className="-mt-0.5" />
            </div>
        </Link>
    );
}