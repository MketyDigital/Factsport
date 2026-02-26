'use client';
import { useState, useEffect } from 'react';
import { Copy, ExternalLink, CheckCircle } from 'lucide-react';
import { createClient } from '@/app/lib/supabase/client';

export default function BettingPromo({ affiliateLink }: { affiliateLink: string | null }) {
  const [copied, setCopied] = useState(false);
  
  // 🟢 DYNAMIC SETTINGS STATE
  const [promo, setPromo] = useState({
      code1x: "FACTSPORT",
      link1x: "https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599",
      codeMel: "FACTSPORT",
      linkMel: "https://refpa54566.com/L?tag=d_1181253m_45415c_&site=1181253&ad=45415"
  });

  useEffect(() => {
      const fetchSettings = async () => {
          const supabase = createClient();
          const { data } = await supabase.from('site_settings').select('*').eq('id', 1).single();
          if (data) {
              setPromo({
                  code1x: data.code_1xbet || promo.code1x,
                  link1x: data.link_1xbet || promo.link1x,
                  codeMel: data.code_melbet || promo.codeMel,
                  linkMel: data.link_melbet || promo.linkMel
              });
          }
      };
      fetchSettings();
  }, []);

  // LOGIC: If admin set a link, it's Melbet. If null, it's 1xBet.
  const isOverride = !!affiliateLink;
  const targetLink = affiliateLink || promo.link1x;
  const targetCode = isOverride ? promo.codeMel : promo.code1x; // Uses specific code

  const copyCode = () => {
      navigator.clipboard.writeText(targetCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  if (isOverride) {
      // 🟡 MELBET DESIGN (Special Admin Override)
      return (
        <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl p-4 text-black shadow-xl relative overflow-hidden group">
            <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-white blur-[50px] opacity-40 group-hover:opacity-50 transition"></div>
            
            <div className="flex justify-between items-start mb-3 relative z-10">
                <div>
                    <h3 className="font-black text-xl italic tracking-tighter">MELBET</h3>
                    <p className="text-[10px] font-bold opacity-80">300% Bonus • Best Odds</p>
                </div>
                <span className="bg-black text-yellow-500 text-[9px] font-black px-2 py-1 rounded">SPECIAL</span>
            </div>
            
            <div className="flex gap-2 relative z-10">
                <button onClick={copyCode} className="flex-1 bg-black/10 hover:bg-black/20 border border-black/5 rounded-lg px-3 py-2 flex items-center justify-between transition active:scale-95">
                    <div className="text-left">
                        <span className="text-[8px] font-bold block opacity-60 uppercase">Code</span>
                        <span className="text-xs font-mono font-black tracking-wider">{targetCode}</span>
                    </div>
                    {copied ? <CheckCircle size={16} className="text-black"/> : <Copy size={16} className="text-black opacity-50"/>}
                </button>
                {/* 🛡️ SECURITY ADDED */}
                <a href={targetLink} target="_blank" rel="noopener noreferrer" className="bg-black text-white px-5 py-2 rounded-lg font-black text-xs flex items-center gap-2 hover:scale-105 transition shadow-lg">
                    BET <ExternalLink size={12}/>
                </a>
            </div>
        </div>
      );
  }

  // 🔵 1XBET DESIGN (Default)
  return (
    <div className="bg-[#1A1A1A] rounded-xl p-4 shadow-xl border border-slate-800 flex flex-col gap-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-20 h-full bg-gradient-to-l from-blue-600/20 to-transparent"></div>
        
        <div className="flex justify-between items-center relative z-10">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white italic shadow-lg">1X</div>
                <div>
                    <div className="text-white font-bold text-sm">1xBet Official</div>
                    <div className="text-blue-400 text-[10px] font-bold">Highest Odds Guaranteed</div>
                </div>
             </div>
        </div>

        <div className="flex gap-2 relative z-10">
             <button onClick={copyCode} className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 flex-1 flex items-center justify-between transition active:scale-95">
                <div className="text-left">
                    <span className="text-[8px] text-slate-400 block uppercase font-bold">Promo Code</span>
                    <span className="text-xs text-white font-mono font-black tracking-wider">{targetCode}</span>
                </div>
                {copied ? <CheckCircle size={16} className="text-green-500"/> : <Copy size={16} className="text-slate-500"/>}
             </button>

             {/* 🛡️ SECURITY ADDED */}
             <a href={targetLink} target="_blank" rel="noopener noreferrer" className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-black px-6 py-2 rounded-lg shadow-lg flex items-center gap-1 transition">
                BET <ExternalLink size={12} />
             </a>
        </div>
    </div>
  );
}