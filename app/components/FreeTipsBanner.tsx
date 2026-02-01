'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Copy, CheckCircle, ExternalLink, Lock, Zap } from 'lucide-react';

export default function FreeTipsBanner() {
  const [copied1x, setCopied1x] = useState(false);
  const [copiedMel, setCopiedMel] = useState(false);

  // 🟢 CONFIGURATION
  const CODE_1XBET = "A8J92"; 
  const CODE_MELBET = "7X2MM";
  
  const LINK_1XBET = "https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599";
  const LINK_MELBET = "https://refpa54566.com/L?tag=d_1181253m_45415c_&site=1181253&ad=45415"; 

  const copyToClipboard = (code: string, type: '1x' | 'mel') => {
    navigator.clipboard.writeText(code);
    if (type === '1x') { setCopied1x(true); setTimeout(() => setCopied1x(false), 2000); }
    else { setCopiedMel(true); setTimeout(() => setCopiedMel(false), 2000); }
  };

  return (
    <div className="bg-[#0f172a] rounded-xl p-3 relative overflow-hidden shadow-lg border border-slate-800 my-4">
      {/* Background Effects */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600 rounded-full blur-[60px] opacity-10 pointer-events-none"></div>
      
      {/* Header (Smaller) */}
      <div className="relative z-10 text-center mb-3">
        <h3 className="text-white text-sm font-black italic uppercase tracking-tighter flex items-center justify-center gap-1.5">
            <Zap className="text-yellow-400 fill-yellow-400" size={14} /> Daily Free Booking Codes
        </h3>
        <p className="text-slate-400 text-[10px] mt-0.5 max-w-sm mx-auto leading-tight">
          Register with code <span className="text-white font-black bg-white/10 px-1 rounded">FACTSPORT</span> to use.
        </p>
      </div>

      {/* Codes Grid (Compact) */}
      <div className="grid grid-cols-2 gap-2 relative z-10">
        
        {/* 1XBET CARD */}
        <div className="bg-[#1A1A1A] p-2 rounded-lg border border-white/5 flex flex-col gap-2 group hover:border-blue-600/50 transition">
             <div className="flex justify-between items-center">
                 <div className="flex items-center gap-1.5">
                     <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center font-black text-white italic text-[9px]">1X</div>
                     <span className="text-slate-300 font-bold text-[10px]">1xBet</span>
                 </div>
                 <span className="text-[9px] text-green-400 font-bold bg-green-900/20 px-1.5 py-0.5 rounded border border-green-900/30">98%</span>
             </div>
             
             <div className="flex gap-1.5">
                <button onClick={() => copyToClipboard(CODE_1XBET, '1x')} className="flex-1 bg-black/40 hover:bg-black/60 border border-white/10 roundedmd h-8 flex items-center justify-between px-2 transition active:scale-95">
                    <span className="font-mono font-black text-white text-xs tracking-wider">{CODE_1XBET}</span>
                    {copied1x ? <CheckCircle size={12} className="text-green-500"/> : <Copy size={12} className="text-slate-500"/>}
                </button>
                <a href={LINK_1XBET} target="_blank" className="bg-blue-600 hover:bg-blue-500 text-white h-8 w-8 rounded-md flex items-center justify-center transition shadow-lg">
                    <ExternalLink size={12}/>
                </a>
             </div>
        </div>

        {/* MELBET CARD */}
        <div className="bg-[#1A1A1A] p-2 rounded-lg border border-white/5 flex flex-col gap-2 group hover:border-yellow-500/50 transition">
             <div className="flex justify-between items-center">
                 <div className="flex items-center gap-1.5">
                     <div className="w-5 h-5 bg-yellow-500 rounded flex items-center justify-center font-black text-black italic text-[9px]">M</div>
                     <span className="text-slate-300 font-bold text-[10px]">Melbet</span>
                 </div>
                 <span className="text-[9px] text-green-400 font-bold bg-green-900/20 px-1.5 py-0.5 rounded border border-green-900/30">Odds</span>
             </div>
             
             <div className="flex gap-1.5">
                <button onClick={() => copyToClipboard(CODE_MELBET, 'mel')} className="flex-1 bg-black/40 hover:bg-black/60 border border-white/10 rounded-md h-8 flex items-center justify-between px-2 transition active:scale-95">
                    <span className="font-mono font-black text-white text-xs tracking-wider">{CODE_MELBET}</span>
                    {copiedMel ? <CheckCircle size={12} className="text-green-500"/> : <Copy size={12} className="text-slate-500"/>}
                </button>
                <a href={LINK_MELBET} target="_blank" className="bg-yellow-500 hover:bg-yellow-400 text-black h-8 w-8 rounded-md flex items-center justify-center transition shadow-lg">
                    <ExternalLink size={12}/>
                </a>
             </div>
        </div>
      </div>

      {/* Upsell Footer (Minimal) */}
      <div className="mt-2 pt-2 border-t border-white/5 text-center">
         <Link href="/vip/upgrade" className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-white transition group">
            <Lock size={10} className="text-yellow-500" />
            <span>Want 50+ Odds? <span className="text-yellow-500 group-hover:underline">Join VIP</span></span>
         </Link>
      </div>
    </div>
  );
}