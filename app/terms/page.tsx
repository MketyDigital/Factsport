import Link from 'next/link';
import { ChevronLeft, BookOpen } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#F0F2F5] p-6 font-sans text-slate-800">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-6 text-sm font-bold transition">
            <ChevronLeft size={16} /> Back to Home
        </Link>
        
        <h1 className="text-2xl font-black uppercase mb-6 flex items-center gap-2">
            <BookOpen className="text-slate-900" /> Terms & Conditions
        </h1>

        <div className="prose prose-slate prose-sm max-w-none space-y-4">
            <p>By accessing FactSport, you agree to these Terms and Conditions.</p>

            <h3 className="font-bold text-slate-900">1. Eligibility</h3>
            <p>You must be at least 18 years old to use this platform. FactSport is intended for users in jurisdictions where online prediction games are legal.</p>

            <h3 className="font-bold text-slate-900">2. Virtual Points & Prizes</h3>
            <p>Points earned on FactSport are virtual. Monthly prizes for VIP members are awarded at the sole discretion of FactSport management. We reserve the right to disqualify any user suspected of cheating, using bots, or exploiting bugs.</p>

            <h3 className="font-bold text-slate-900">3. VIP Membership</h3>
            <p>VIP status grants access to enhanced leaderboard features and prize eligibility. VIP payments are final and non-refundable unless otherwise stated by local law.</p>

            <h3 className="font-bold text-slate-900">4. Limitation of Liability</h3>
            <p>FactSport is provided "as is". We are not liable for any losses incurred from reliance on our predictions, statistics, or third-party affiliate links. Betting involves risk; please gamble responsibly.</p>

            <h3 className="font-bold text-slate-900">5. Termination</h3>
            <p>We reserve the right to terminate or suspend your account immediately, without prior notice, for conduct that we believe violates these Terms.</p>
        </div>
      </div>
    </div>
  );
}