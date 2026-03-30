'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Copy, CheckCircle, ExternalLink, Lock, Zap } from 'lucide-react';

export default function FreeTipsBanner() {
  const [copied1x, setCopied1x] = useState(false);
  const [copiedMel, setCopiedMel] = useState(false);
  const PROMO_CODE = "FACTSPORT";

  const [globalLinks, setGlobalLinks] = useState({
      link1x: "https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599",
      linkMel: "https://refpa54566.com/L?tag=d_1181253m_45415c_&site=1181253&ad=45415"
  });
  const [bookingCodes, setBookingCodes] = useState({ code1x: "A8J92", codeMel: "7X2MM" });

  useEffect(() => {
      const fetchData = async () => {
          try {
              const res = await fetch('/api/settings');
              if (!res.ok) return;
              const data = await res.json();
              setGlobalLinks({ link1x: data.link1x || globalLinks.link1x, linkMel: data.linkMel || globalLinks.linkMel });
              setBookingCodes({ code1x: data.code1x || bookingCodes.code1x, codeMel: data.codeMel || bookingCodes.codeMel });
          } catch (e) {}
      };
      fetchData();
  }, []);

  const copyToClipboard = (code: string, type: '1x' | 'mel') => {
    navigator.clipboard.writeText(code);
    if (type === '1x') { setCopied1x(true); setTimeout(() => setCopied1x(false), 2000); }
    else { setCopiedMel(true); setTimeout(() => setCopiedMel(false), 2000); }
  };

  return (
    <div className="bg-[#0a1428] rounded-lg p-1.5 md:p-2 relative overflow-hidden shadow-sm border border-slate-800 mb-3">
      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600 rounded-full blur-[50px] opacity-20 pointer-events-none"></div>
      
      {/* Tiny Header */}
      <div className="relative z-10 flex items-center justify-between mb-1.5 px-1">
        <h3 className="text-white text-[9px] md:text-[10px] font-black italic uppercase tracking-tighter flex items-center gap-1">
            <Zap className="text-yellow-400 fill-yellow-400" size={10} /> Daily Free Codes
        </h3>
        <p className="text-slate-400 text-[7px] md:text-[8px] leading-tight">
          Promo: <span className="text-white font-black bg-white/10 px-1 py-0.5 rounded shadow-sm">{PROMO_CODE}</span>
        </p>
      </div>

      {/* Squashed Grid */}
      <div className="grid grid-cols-2 gap-1.5 relative z-10">
        {/* 1XBET */}
        <div className="bg-[#1A1A1A] p-1.5 rounded-md border border-white/5 flex flex-col gap-1.5 shadow-sm">
             <div className="flex justify-between items-center">
                 <div className="flex items-center gap-1">
                     <div className="w-3.5 h-3.5 bg-blue-600 rounded flex items-center justify-center font-black text-white italic text-[6px]">1X</div>
                     <span className="text-slate-200 font-bold text-[8px]">1xBet</span>
                 </div>
                 <span className="text-[7px] text-green-400 font-bold bg-green-900/30 px-1 py-0.5 rounded border border-green-900/50">98%</span>
             </div>
             <div className="flex gap-1">
                <button onClick={() => copyToClipboard(bookingCodes.code1x, '1x')} className="flex-1 bg-black/40 hover:bg-black/60 border border-white/10 rounded h-6 flex items-center justify-between px-1.5 transition active:scale-95 shadow-inner">
                    <span className="font-mono font-black text-white text-[9px] tracking-wider">{bookingCodes.code1x}</span>
                    {copied1x ? <CheckCircle size={10} className="text-green-500"/> : <Copy size={10} className="text-slate-500"/>}
                </button>
                <a href={globalLinks.link1x} target="_blank" rel="noopener noreferrer" className="bg-blue-600 hover:bg-blue-500 text-white h-6 w-6 rounded flex items-center justify-center transition shadow-sm shrink-0">
                    <ExternalLink size={10}/>
                </a>
             </div>
        </div>

        {/* MELBET */}
        <div className="bg-[#1A1A1A] p-1.5 rounded-md border border-white/5 flex flex-col gap-1.5 shadow-sm">
             <div className="flex justify-between items-center">
                 <div className="flex items-center gap-1">
                     <div className="w-3.5 h-3.5 bg-yellow-500 rounded flex items-center justify-center font-black text-black italic text-[6px]">M</div>
                     <span className="text-slate-200 font-bold text-[8px]">Melbet</span>
                 </div>
                 <span className="text-[7px] text-green-400 font-bold bg-green-900/30 px-1 py-0.5 rounded border border-green-900/50">Odds</span>
             </div>
             <div className="flex gap-1">
                <button onClick={() => copyToClipboard(bookingCodes.codeMel, 'mel')} className="flex-1 bg-black/40 hover:bg-black/60 border border-white/10 rounded h-6 flex items-center justify-between px-1.5 transition active:scale-95 shadow-inner">
                    <span className="font-mono font-black text-white text-[9px] tracking-wider">{bookingCodes.codeMel}</span>
                    {copiedMel ? <CheckCircle size={10} className="text-green-500"/> : <Copy size={10} className="text-slate-500"/>}
                </button>
                <a href={globalLinks.linkMel} target="_blank" rel="noopener noreferrer" className="bg-yellow-500 hover:bg-yellow-400 text-black h-6 w-6 rounded flex items-center justify-center transition shadow-sm shrink-0">
                    <ExternalLink size={10}/>
                </a>
             </div>
        </div>
      </div>
    </div>
  );
}