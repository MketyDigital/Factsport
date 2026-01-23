import Link from 'next/link';
import { ChevronLeft, ShieldAlert } from 'lucide-react';

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-[#F0F2F5] p-6 font-sans text-slate-800">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-6 text-sm font-bold transition">
            <ChevronLeft size={16} /> Back to Home
        </Link>
        
        <h1 className="text-2xl font-black uppercase mb-6 flex items-center gap-2">
            <ShieldAlert className="text-red-600" /> Disclaimer & Disclosure
        </h1>

        <div className="prose prose-slate prose-sm max-w-none space-y-6">
            
            <section>
                <h3 className="font-bold text-lg text-slate-900">1. Not a Gambling Site</h3>
                <p>
                    FactSport is strictly a <strong>sports information and prediction game platform</strong>. We do NOT accept real money deposits, we do NOT take bets, and we do NOT operate as a lottery or casino. 
                </p>
                <p>
                    Any "points" earned on FactSport are virtual points used solely for ranking on our leaderboard. They have no cash value and cannot be withdrawn or exchanged for currency.
                </p>
            </section>

            <section>
                <h3 className="font-bold text-lg text-slate-900">2. Affiliate Disclosure</h3>
                <p>
                    FactSport contains links to third-party websites, including sports betting operators (e.g., 1xBet, Bet9ja). We may receive a commission if you click these links and register or place a bet on their platforms.
                </p>
                <p>
                    We are not responsible for the content, terms, or actions of these third-party websites. If you choose to visit them, you do so at your own risk and subject to their terms and conditions.
                </p>
            </section>

            <section>
                <h3 className="font-bold text-lg text-slate-900">3. Responsible Gaming</h3>
                <p>
                    While FactSport is free to play, the third-party sites we link to may involve real money gambling. Gambling carries financial risk and risk of addiction.
                </p>
                <p className="font-bold text-red-600">
                    You must be 18+ to use this platform. If you or someone you know has a gambling problem, please seek help immediately.
                </p>
            </section>

            <section>
                <h3 className="font-bold text-lg text-slate-900">4. Accuracy of Information</h3>
                <p>
                    While we strive for accuracy, match scores, statistics, and news provided on FactSport are for entertainment purposes. We do not guarantee the accuracy of live scores or prediction outcomes.
                </p>
            </section>

        </div>
      </div>
    </div>
  );
}