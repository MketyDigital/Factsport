'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Copy, CheckCircle, ExternalLink, Lock, Zap } from 'lucide-react';
import { createClient } from '@/app/lib/supabase/client'; 

export default function FreeTipsBanner() {
  const [copied1x, setCopied1x] = useState(false);
  const [copiedMel, setCopiedMel] = useState(false);

  // 🟢 CONSTANT: Registration Promo (Never changes, protects your affiliate tracking)
  const PROMO_CODE = "FACTSPORT";

  // 🟢 DYNAMIC LINKS (Fetched from Admin Panel)
  const [globalLinks, setGlobalLinks] = useState({
      link1x: "https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599",
      linkMel: "https://refpa54566.com/L?tag=d_1181253m_45415c_&site=1181253&ad=45415"
  });

  // 🟢 DAILY BOOKING CODES (Fetched from Admin Panel)
  const [bookingCodes, setBookingCodes] = useState({
      code1x: "A8J92",
      codeMel: "7X2MM"
  });

  useEffect(() => {
      const fetchData = async () => {
          const supabase = createClient();
          
          // 1. Fetch Global Settings (Links AND Daily Slip Codes)
          const { data: settings } = await supabase.from('site_settings').select('*').eq('id', 1).single();
          if (settings) {
              setGlobalLinks({
                  link1x: settings.link_1xbet || globalLinks.link1x,
                  linkMel: settings.link_melbet || globalLinks.linkMel
              });
              
              // Map the Admin Panel codes directly to the Betting Slips!
              setBookingCodes(prev => ({
                  code1x: settings.code_1xbet || prev.code1x,
                  codeMel: settings.code_melbet || prev.codeMel
              }));
          }

          // 2. Fallback: If Admin 1xBet code is empty, try to find the newest match with a code
          if (!settings?.code_1xbet) {
              const { data: latestMatch } = await supabase
                .from('matches')
                .select('booking_code')
                .not('booking_code', 'is', null)
                .neq('booking_code', '')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

              if (latestMatch?.booking_code) {
                  setBookingCodes(prev => ({ ...prev, code1x: latestMatch.booking_code }));
              }
          }
      };
      fetchData();
  }, []);

  const copyToClipboard = (code: string, type: '1x' | 'mel') => {
    navigator.clipboard.writeText(code);
    if (type === '1x') { setCopied1x(true); setTimeout(() => setCopied1x(false), 2000); }
    else { setCopiedMel(true); setTimeout(() => setCopiedMel(false), 2000); }
  };

  return (
    <div className="bg-[#0a1428] rounded-xl p-3 relative overflow-hidden shadow-xl border border-slate-800 my-4">
      {/* Background Effects */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600 rounded-full blur-[70px] opacity-20 pointer-events-none"></div>
      
      {/* Header */}
      <div className="relative z-10 text-center mb-3">
        <h3 className="text-white text-sm font-black italic uppercase tracking-tighter flex items-center justify-center gap-1.5">
            <Zap className="text-yellow-400 fill-yellow-400" size={14} /> Daily Free Booking Codes
        </h3>
        <p className="text-slate-400 text-[10px] mt-1 max-w-sm mx-auto leading-tight">
          Register with promo code <span className="text-white font-black bg-white/10 px-1.5 py-0.5 rounded ml-0.5 shadow-sm border border-white/5">{PROMO_CODE}</span> to use these slips.
        </p>
      </div>

      {/* Codes Grid */}
      <div className="grid grid-cols-2 gap-2 relative z-10">
        
        {/* 1XBET CARD */}
        <div className="bg-[#1A1A1A] p-2.5 rounded-lg border border-white/5 flex flex-col gap-2.5 group hover:border-blue-600/50 transition shadow-md">
             <div className="flex justify-between items-center">
                 <div className="flex items-center gap-1.5">
                     <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center font-black text-white italic text-[9px] shadow-sm">1X</div>
                     <span className="text-slate-200 font-bold text-[10px]">1xBet</span>
                 </div>
                 <span className="text-[9px] text-green-400 font-bold bg-green-900/30 px-1.5 py-0.5 rounded border border-green-900/50">98%</span>
             </div>
             
             <div className="flex gap-1.5">
                <button onClick={() => copyToClipboard(bookingCodes.code1x, '1x')} className="flex-1 bg-black/40 hover:bg-black/60 border border-white/10 rounded-md h-8 flex items-center justify-between px-2 transition active:scale-95 shadow-inner">
                    <span className="font-mono font-black text-white text-xs tracking-wider">{bookingCodes.code1x}</span>
                    {copied1x ? <CheckCircle size={12} className="text-green-500"/> : <Copy size={12} className="text-slate-500"/>}
                </button>
                <a href={globalLinks.link1x} target="_blank" rel="noopener noreferrer" className="bg-blue-600 hover:bg-blue-500 text-white h-8 w-8 rounded-md flex items-center justify-center transition shadow-lg shrink-0">
                    <ExternalLink size={12}/>
                </a>
             </div>
        </div>

        {/* MELBET CARD */}
        <div className="bg-[#1A1A1A] p-2.5 rounded-lg border border-white/5 flex flex-col gap-2.5 group hover:border-yellow-500/50 transition shadow-md">
             <div className="flex justify-between items-center">
                 <div className="flex items-center gap-1.5">
                     <div className="w-5 h-5 bg-yellow-500 rounded flex items-center justify-center font-black text-black italic text-[9px] shadow-sm">M</div>
                     <span className="text-slate-200 font-bold text-[10px]">Melbet</span>
                 </div>
                 <span className="text-[9px] text-green-400 font-bold bg-green-900/30 px-1.5 py-0.5 rounded border border-green-900/50">Odds</span>
             </div>
             
             <div className="flex gap-1.5">
                <button onClick={() => copyToClipboard(bookingCodes.codeMel, 'mel')} className="flex-1 bg-black/40 hover:bg-black/60 border border-white/10 rounded-md h-8 flex items-center justify-between px-2 transition active:scale-95 shadow-inner">
                    <span className="font-mono font-black text-white text-xs tracking-wider">{bookingCodes.codeMel}</span>
                    {copiedMel ? <CheckCircle size={12} className="text-green-500"/> : <Copy size={12} className="text-slate-500"/>}
                </button>
                <a href={globalLinks.linkMel} target="_blank" rel="noopener noreferrer" className="bg-yellow-500 hover:bg-yellow-400 text-black h-8 w-8 rounded-md flex items-center justify-center transition shadow-lg shrink-0">
                    <ExternalLink size={12}/>
                </a>
             </div>
        </div>
      </div>

      {/* Upsell Footer */}
      <div className="mt-3 pt-3 border-t border-white/10 text-center">
         <Link href="/vip/upgrade" className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-white transition group bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
            <Lock size={10} className="text-yellow-500" />
            <span>Want 50+ Odds? <span className="text-yellow-500 group-hover:underline ml-0.5">Join VIP</span></span>
         </Link>
      </div>
    </div>
  );
}