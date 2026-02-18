export const runtime = 'edge';

import Link from 'next/link';
import { ChevronLeft, BookOpen, Scale, Gavel } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#F0F2F5] p-6 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-200">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-8 text-sm font-bold transition">
            <ChevronLeft size={16} /> Back to Home
        </Link>
        
        <header className="mb-10 border-b border-slate-100 pb-6">
            <h1 className="text-3xl font-black uppercase mb-3 flex items-center gap-3 text-slate-900">
                <BookOpen className="text-blue-600" size={32} /> Terms of Service
            </h1>
            <p className="text-slate-500 text-sm">Last Updated: February 2026</p>
        </header>

        <div className="prose prose-slate prose-sm max-w-none space-y-8">
            <p className="lead text-lg text-slate-600">
                Welcome to <strong>FactSport</strong> ("we," "us," or "our"). By accessing our website, mobile application, or media services (including FactSport TV and Radio), you agree to be bound by these Terms.
            </p>

            <section>
                <h3 className="font-bold text-xl text-slate-900 mb-3">1. Service Description & Usage</h3>
                <p>FactSport is a digital sports media platform providing news, analysis, audiovisual content, and a free-to-play prediction game. You agree to use this platform only for lawful purposes. You must not use our services to distribute spam, malware, or engage in harassment.</p>
            </section>

            <section>
                <h3 className="font-bold text-xl text-slate-900 mb-3">2. Intellectual Property & Media Rights</h3>
                <ul className="list-disc pl-5 space-y-2">
                    <li><strong>News & Editorial:</strong> Our news content is original or rewritten from official sources (club press releases, media kits) in accordance with fair use principles for news reporting.</li>
                    <li><strong>Third-Party Assets:</strong> Club logos and team names are the property of their respective owners. We use them solely for identification and informational purposes.</li>
                    <li><strong>YouTube & Embeds:</strong> We may embed content from official YouTube channels (e.g., Highlights). By watching this content, you also agree to <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer" className="text-blue-600 underline">YouTube's Terms of Service</a>.</li>
                </ul>
            </section>

            <section>
                <h3 className="font-bold text-xl text-slate-900 mb-3">3. Prediction Game & Contest Rules</h3>
                <p>Our "Predict & Win" game is a game of skill, not chance. To participate:</p>
                <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Virtual Points:</strong> Points awarded (3pts for Outcome, 10pts for Exact Score) have no cash value and cannot be exchanged for currency.</li>
                    <li><strong>Prize Eligibility:</strong> Monthly prizes are reserved strictly for <strong>VIP Members</strong>. Free users may appear on the leaderboard but are not eligible for physical or cash rewards.</li>
                    <li><strong>Winning Criteria:</strong> To claim a 1st, 2nd, or 3rd place prize, a user must meet the specific criteria set out in our "How to Play" rules (e.g., minimum 3 Correct Scores per month).</li>
                    <li><strong>Fair Play:</strong> We reserve the right to disqualify any user suspected of multi-accounting, bot usage, or exploiting system glitches.</li>
                </ul>
            </section>

            <section>
                <h3 className="font-bold text-xl text-slate-900 mb-3">4. VIP Membership & Payments</h3>
                <p>VIP subscriptions grant access to premium features and prize eligibility.</p>
                <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Non-Refundable:</strong> All VIP payments are final and non-refundable, except where required by applicable consumer law.</li>
                    <li><strong>No Guarantee:</strong> Purchasing VIP status does not guarantee a prize; it only grants eligibility to compete for one.</li>
                </ul>
            </section>

            <section>
                <h3 className="font-bold text-xl text-slate-900 mb-3">5. Disclaimer of Warranties</h3>
                <p>FactSport is provided "as is." We do not guarantee that match data, live scores, or news updates will be error-free or uninterrupted. We are not responsible for any decisions you make based on our analysis or predictions.</p>
            </section>

            <section>
                <h3 className="font-bold text-xl text-slate-900 mb-3">6. Governing Law</h3>
                <p>These Terms are governed by the laws of the jurisdiction in which FactSport is registered. Any disputes shall be resolved through binding arbitration.</p>
            </section>
        </div>
      </div>
    </div>
  );
}
