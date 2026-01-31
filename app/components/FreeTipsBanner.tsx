'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Copy, CheckCircle, ExternalLink, Lock, Zap } from 'lucide-react';

export default function FreeTipsBanner() {
  const [copied1x, setCopied1x] = useState(false);
  const [copiedMel, setCopiedMel] = useState(false);

  // 🟢 CONFIGURATION (Change your codes here daily!)
  const CODE_1XBET = "A8J92"; 
  const CODE_MELBET = "7X2MM";
  
  const LINK_1XBET = "https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599";
  const LINK_MELBET = "https://refpa3665.com/L?tag=d_4918250m_45415c_&site=4918250&ad=45415"; // Replace with your Melbet Link if different

  const copyToClipboard = (code: string, type: '1x' | 'mel') => {
    navigator.clipboard.writeText(code);
    if (type === '1x') { setCopied1x(true); setTimeout(() => setCopied1x(false), 2000); }
    else { setCopiedMel(true); setTimeout(() => setCopiedMel(false), 2000); }
  };

  return (
    <div className="bg-[#0f172a] rounded-2xl p-6 relative overflow-hidden shadow-2xl border border-slate-800 my-6">
      {/* Background Effects */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[80px] opacity-10 pointer-events-none"></div>
      
      {/* Header */}
      <div className="relative z-10 text-center mb-6">
        <h3 className="text-white text-xl font-black italic uppercase tracking-tighter flex items-center justify-center gap-2">
            <Zap className="text-yellow-400 fill-yellow-400" size={20} /> Daily Free Booking Codes
        </h3>
        <p className="text-slate-400 text-xs mt-1 max-w-md mx-auto">
          <span className="text-red-400 font-bold uppercase">Important:</span> You MUST register with Promo Code <span className="text-white font-black bg-white/10 px-1 rounded">FACTSPORT</span> to use these codes successfully.
        </p>
      </div>

      {/* Codes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
        
        {/* 1XBET CARD */}
        <div className="bg-[#1A1A1A] p-4 rounded-xl border border-white/5 flex flex-col gap-3 group hover:border-blue-600/50 transition">
             <div className="flex justify-between items-center">
                 <div className="flex items-center gap-2">
                     <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-black text-white italic text-xs">1X</div>
                     <span className="text-slate-300 font-bold text-xs">1xBet Slip</span>
                 </div>
                 <span className="text-[10px] text-green-400 font-bold bg-green-900/20 px-2 py-1 rounded border border-green-900/30">98% Accuracy</span>
             </div>
             
             <div className="flex gap-2">
                <button onClick={() => copyToClipboard(CODE_1XBET, '1x')} className="flex-1 bg-black/40 hover:bg-black/60 border border-white/10 rounded-lg h-10 flex items-center justify-between px-3 transition active:scale-95">
                    <span className="font-mono font-black text-white text-sm tracking-wider">{CODE_1XBET}</span>
                    {copied1x ? <CheckCircle size={14} className="text-green-500"/> : <Copy size={14} className="text-slate-500"/>}
                </button>
                <a href={LINK_1XBET} target="_blank" className="bg-blue-600 hover:bg-blue-500 text-white h-10 px-4 rounded-lg flex items-center justify-center font-black text-[10px] transition shadow-lg">
                    BET <ExternalLink size={12} className="ml-1"/>
                </a>
             </div>
        </div>

        {/* MELBET CARD */}
        <div className="bg-[#1A1A1A] p-4 rounded-xl border border-white/5 flex flex-col gap-3 group hover:border-yellow-500/50 transition">
             <div className="flex justify-between items-center">
                 <div className="flex items-center gap-2">
                     <div className="w-8 h-8 bg-yellow-500 rounded flex items-center justify-center font-black text-black italic text-xs">M</div>
                     <span className="text-slate-300 font-bold text-xs">Melbet Slip</span>
                 </div>
                 <span className="text-[10px] text-green-400 font-bold bg-green-900/20 px-2 py-1 rounded border border-green-900/30">High Odds</span>
             </div>
             
             <div className="flex gap-2">
                <button onClick={() => copyToClipboard(CODE_MELBET, 'mel')} className="flex-1 bg-black/40 hover:bg-black/60 border border-white/10 rounded-lg h-10 flex items-center justify-between px-3 transition active:scale-95">
                    <span className="font-mono font-black text-white text-sm tracking-wider">{CODE_MELBET}</span>
                    {copiedMel ? <CheckCircle size={14} className="text-green-500"/> : <Copy size={14} className="text-slate-500"/>}
                </button>
                <a href={LINK_MELBET} target="_blank" className="bg-yellow-500 hover:bg-yellow-400 text-black h-10 px-4 rounded-lg flex items-center justify-center font-black text-[10px] transition shadow-lg">
                    BET <ExternalLink size={12} className="ml-1"/>
                </a>
             </div>
        </div>
      </div>

      {/* Upsell Footer */}
      <div className="mt-6 pt-4 border-t border-white/5 text-center">
         <Link href="/vip/upgrade" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition group">
            <Lock size={12} className="text-yellow-500" />
            <span>Want 50+ Odds & Premium Codes? <span className="text-yellow-500 group-hover:underline">Join VIP Now</span></span>
         </Link>
      </div>
    </div>
  );
}