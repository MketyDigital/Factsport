export const runtime = 'edge';

import Link from 'next/link';
import { ChevronLeft, ShieldAlert, AlertTriangle, Info } from 'lucide-react';

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-[#F0F2F5] p-6 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-200">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-8 text-sm font-bold transition">
            <ChevronLeft size={16} /> Back to Home
        </Link>
        
        <header className="mb-10 border-b border-slate-100 pb-6">
            <h1 className="text-3xl font-black uppercase mb-3 flex items-center gap-3 text-red-600">
                <ShieldAlert size={32} /> Disclaimer & Risk Disclosure
            </h1>
            <p className="text-slate-500 text-sm">Please read this document carefully before using our platform.</p>
        </header>

        <div className="prose prose-slate prose-sm max-w-none space-y-8">
            
            {/* CRITICAL: NO GAMBLING SECTION */}
            <section className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-lg">
                <h3 className="font-bold text-xl text-red-800 mb-2 flex items-center gap-2">
                    <AlertTriangle size={24} /> 1. NOT A GAMBLING SITE
                </h3>
                <p className="text-red-900 font-medium">
                    FactSport is strictly a <strong>sports media and prediction game platform</strong>. 
                </p>
                <ul className="list-disc pl-5 mt-3 space-y-1 text-red-800">
                    <li>We do <strong>NOT</strong> accept real money deposits.</li>
                    <li>We do <strong>NOT</strong> facilitate real money betting or bookmaking.</li>
                    <li>Points earned on FactSport are <strong>virtual</strong> and have no cash exchange value.</li>
                </ul>
            </section>

            <section>
                <h3 className="font-bold text-xl text-slate-900 mb-3">2. Affiliate Disclosure</h3>
                <p>
                    FactSport acts as an affiliate marketer. We may display advertisements or links to third-party sports betting operators (e.g., 1xBet, Bet9ja, BetKing).
                </p>
                <p className="italic text-slate-600 border-l-2 border-slate-300 pl-4 mt-2">
                    "If you click on these links and register or place a bet, FactSport may receive a commission. This comes at no extra cost to you and helps support our free content."
                </p>
                <p className="mt-2">
                    We are not responsible for the actions, terms, or privacy practices of these third-party websites. You access them at your own risk.
                </p>
            </section>

            <section>
                <h3 className="font-bold text-xl text-slate-900 mb-3">3. Responsible Gaming Warning</h3>
                <p>
                    While FactSport itself is risk-free, the third-party betting sites we may link to involve financial risk. Gambling can be addictive.
                </p>
                <p className="font-bold text-slate-900 mt-2">
                    You must be 18+ to use our platform. If you or someone you know has a gambling problem, please seek help from your local authorities.
                </p>
            </section>

            <section>
                <h3 className="font-bold text-xl text-slate-900 mb-3 flex items-center gap-2">
                    <Info size={20} /> 4. Accuracy of Information
                </h3>
                <p>
                    <strong>News & Scores:</strong> While we strive for accuracy, live scores, match statistics, and news reports are provided for information and entertainment purposes only. We do not guarantee zero latency or absolute accuracy (e.g., a score might display 1-0 while a VAR check is ongoing).
                </p>
                <p>
                    <strong>Predictions:</strong> Our editorial predictions and analysis are opinions, not financial advice. Past performance is not indicative of future results.
                </p>
            </section>

        </div>
      </div>
    </div>
  );
}