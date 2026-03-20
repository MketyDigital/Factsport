'use client';
import { useState, useEffect } from 'react';
import { Copy, ExternalLink, CheckCircle, Gift } from 'lucide-react';

export default function BettingPromo({ affiliateLink }: { affiliateLink: string | null }) {
  const [copied, setCopied] = useState(false);
  
  // 🟢 CONSTANT: Affiliate Promo Code is permanently locked
  const PROMO_CODE = "FACTSPORT";

  // 🟢 DYNAMIC: Affiliate Links fetched from the highly-cached API
  const [links, setLinks] = useState({
      link1x: "https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599",
      linkMel: "https://refpa54566.com/L?tag=d_1181253m_45415c_&site=1181253&ad=45415"
  });

  useEffect(() => {
      const fetchSettings = async () => {
          try {
              // 🟢 ZERO DATABASE COST: Fetching from the cached Vercel Edge
              const res = await fetch('/api/settings');
              if (!res.ok) return;
              const data = await res.json();
              
              setLinks({
                  link1x: data.link1x || links.link1x,
                  linkMel: data.linkMel || links.linkMel
              });
          } catch (e) {
              console.error("Failed to load promo settings", e);
          }
      };
      fetchSettings();
  }, []);

  // 🟢 Changed default fallback to Melbet
  const targetLink = affiliateLink || links.linkMel;

  const copyCode = () => {
      navigator.clipboard.writeText(PROMO_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#121418] border border-yellow-500/20 rounded-lg p-2.5 shadow-md relative overflow-hidden flex items-center justify-between w-full">
        {/* Subtle Melbet Yellow Glow in the background */}
        <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-yellow-500/10 to-transparent pointer-events-none"></div>
        
        {/* LEFT: Brand & Offer */}
        <div className="flex items-center gap-2.5 relative z-10">
             <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded flex items-center justify-center font-black text-black text-[10px] italic shadow-inner">
                 MEL
             </div>
             <div className="flex flex-col justify-center">
                 <div className="text-white font-bold text-xs leading-none flex items-center gap-1">
                     Melbet <Gift size={10} className="text-yellow-500" />
                 </div>
                 <div className="text-yellow-500 text-[9px] font-bold mt-0.5 uppercase tracking-wider">
                     300% Welcome Bonus
                 </div>
             </div>
        </div>

        {/* RIGHT: Promo Code & Action Button */}
        <div className="flex items-center gap-2 relative z-10">
             {/* Click to Copy Code */}
             <button 
                 onClick={copyCode} 
                 className="flex items-center gap-1.5 bg-black/40 hover:bg-black/60 border border-white/5 rounded px-2.5 py-1.5 transition active:scale-95"
                 title="Copy Promo Code"
             >
                 <span className="text-[9px] text-slate-400 uppercase font-bold hidden sm:block">Code:</span>
                 <span className="text-xs text-white font-mono font-black tracking-wide">{PROMO_CODE}</span>
                 {copied ? <CheckCircle size={14} className="text-green-500"/> : <Copy size={14} className="text-slate-500"/>}
             </button>

             {/* Bet Button */}
             <a 
                 href={targetLink} 
                 target="_blank" 
                 rel="noopener noreferrer" 
                 className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black text-[10px] font-black px-4 py-1.5 rounded flex items-center gap-1 transition-all active:scale-95 shadow-md uppercase tracking-widest"
             >
                 BET <ExternalLink size={12} />
             </a>
        </div>
    </div>
  );
}