import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0a1428] text-slate-400 py-12 px-6 mt-12 border-t border-white/5 font-sans">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
        
        {/* Brand Section */}
        <div className="col-span-1 md:col-span-2">
            <h2 className="text-white font-black text-xl italic tracking-tighter mb-4">
              FACT<span className="text-blue-600">SPORT</span>
            </h2>
            <p className="text-xs leading-relaxed max-w-xs text-slate-500">
                The ultimate sports prediction platform. Watch highlights, get expert betting tips, and compete for monthly cash prizes.
            </p>
        </div>

        {/* Platform Links */}
        <div>
            <h3 className="text-white text-xs font-bold uppercase tracking-widest mb-4">Platform</h3>
            <ul className="space-y-2 text-xs">
                <li><Link href="/" className="hover:text-white transition">Matches</Link></li>
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
                <li><Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
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