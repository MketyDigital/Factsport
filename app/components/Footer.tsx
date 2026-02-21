import Link from 'next/link';
// 🟢 Removed Zap since we are using the real logo image now
import { Facebook, Instagram, Twitter, Youtube, Send } from 'lucide-react'; 

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0a1428] text-slate-400 py-12 px-6 mt-12 border-t border-white/5 font-sans">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
        
        {/* Brand Section */}
        <div className="col-span-1 md:col-span-2">
            
            {/* 🟢 REAL LOGO (Using logo.png from public folder) */}
            <div className="mb-4 inline-block">
                <img 
                    src="/logo.png" 
                    alt="FactSport Logo" 
                    className="h-8 md:h-10 w-auto object-contain drop-shadow-lg" 
                />
            </div>

            <p className="text-xs leading-relaxed max-w-xs text-slate-500">
                The ultimate sports prediction platform. Watch highlights, get expert betting tips, and compete for monthly cash prizes.
            </p>

            {/* Social Media Buttons */}
            <div className="flex items-center gap-3 mt-6 flex-wrap">
                {/* Facebook (General) */}
                <a href="https://facebook.com/factsportlive" target="_blank" title="General Sport News" className="bg-white/5 hover:bg-blue-600 text-white p-2 rounded-lg transition active:scale-95">
                    <Facebook size={16} />
                </a>
                
                {/* Facebook (Football Only) */}
                <a href="https://facebook.com/Factsportfootball" target="_blank" title="Football Updates Only" className="bg-white/5 hover:bg-blue-600 text-white p-2 rounded-lg transition active:scale-95 relative">
                    <Facebook size={16} />
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                </a>

                {/* Instagram */}
                <a href="https://instagram.com/factsportlive" target="_blank" className="bg-white/5 hover:bg-pink-600 text-white p-2 rounded-lg transition active:scale-95">
                    <Instagram size={16} />
                </a>

                {/* X (Twitter) */}
                <a href="https://x.com/factsportlive" target="_blank" className="bg-white/5 hover:bg-black text-white p-2 rounded-lg transition active:scale-95">
                    <Twitter size={16} />
                </a>

                {/* Telegram */}
                <a href="https://t.me/Factsportlive" target="_blank" className="bg-white/5 hover:bg-sky-500 text-white p-2 rounded-lg transition active:scale-95">
                    <Send size={16} />
                </a>

                {/* YouTube */}
                <a href="https://youtube.com/@factsportlive" target="_blank" className="bg-white/5 hover:bg-red-600 text-white p-2 rounded-lg transition active:scale-95">
                    <Youtube size={16} />
                </a>
            </div>
        </div>

        {/* Platform Links */}
        <div>
            <h3 className="text-white text-xs font-bold uppercase tracking-widest mb-4">Platform</h3>
            <ul className="space-y-2 text-xs">
                <li><Link href="/matches" className="hover:text-white transition">Matches</Link></li>
                <li><Link href="/news" className="hover:text-white transition">News</Link></li>
                <li><Link href="/leaderboard" className="hover:text-white transition">Leaderboard</Link></li>
                <li><Link href="/vip/upgrade" className="hover:text-yellow-400 transition font-bold text-yellow-500">VIP Upgrade</Link></li>
            </ul>
        </div>

        {/* Legal Links */}
        <div>
            <h3 className="text-white text-xs font-bold uppercase tracking-widest mb-4">Legal</h3>
            <ul className="space-y-2 text-xs">
                <li><Link href="/how-to-play" className="hover:text-white transition">How to Play</Link></li>
                <li><Link href="/terms" className="hover:text-white transition">Terms & Conditions</Link></li>
                <li><Link href="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link></li>
                <li><Link href="/disclaimer" className="hover:text-white transition">Disclaimer</Link></li>
                <li className="text-red-500 font-bold mt-3 border-t border-white/5 pt-2">18+ Gamble Responsibly</li>
            </ul>
        </div>
      </div>

      {/* Copyright & Safe Harbor Statement */}
      <div className="border-t border-white/5 pt-8 text-center text-[10px] text-slate-600 leading-relaxed">
        <p>&copy; {currentYear} FactSport. All rights reserved.</p>
        <p className="mt-2 max-w-2xl mx-auto">
            FactSport is not a bookmaker, betting site, or lottery operator. We provide sports information and a free-to-play prediction game for entertainment purposes only. We do not accept real money deposits.
        </p>
      </div>
    </footer>
  );
}