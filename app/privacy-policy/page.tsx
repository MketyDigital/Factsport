export const runtime = 'edge';

import Link from 'next/link';
import { ChevronLeft, Lock, Eye, Server } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F0F2F5] p-6 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-200">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-8 text-sm font-bold transition">
            <ChevronLeft size={16} /> Back to Home
        </Link>
        
        <header className="mb-10 border-b border-slate-100 pb-6">
            <h1 className="text-3xl font-black uppercase mb-3 flex items-center gap-3 text-slate-900">
                <Lock className="text-blue-600" size={32} /> Privacy Policy
            </h1>
            <p className="text-slate-500 text-sm">Last Updated: February 2026</p>
        </header>

        <div className="prose prose-slate prose-sm max-w-none space-y-8">
            <p className="text-lg text-slate-600">
                Your privacy is paramount. This policy outlines how <strong>FactSport</strong> collects, uses, and protects your personal data.
            </p>

            <section>
                <h3 className="font-bold text-xl text-slate-900 mb-3 flex items-center gap-2"><Eye size={20} /> 1. Information We Collect</h3>
                <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Account Information:</strong> When you register by providing your details or via Google, we collect your email address, full name, and profile picture.</li>
                    <li><strong>Game Data:</strong> We record your predictions, points earned, and win/loss history to maintain the global leaderboard.</li>
                    <li><strong>Technical Data:</strong> We may collect IP addresses and browser types for security purposes (e.g., to prevent duplicate voting).</li>
                </ul>
            </section>

            <section>
                <h3 className="font-bold text-xl text-slate-900 mb-3 flex items-center gap-2"><Server size={20} /> 2. How We Use Your Data</h3>
                <p>We use your data solely for:</p>
                <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Service Operation:</strong> Authenticating you and saving your predictions.</li>
                    <li><strong>Leaderboards (Public Disclosure):</strong> By playing, you agree that your Name and Profile Picture will be publicly visible on the Leaderboard if you rank among the top players.</li>
                    <li><strong>Communication:</strong> Sending prize notifications or important service updates.</li>
                </ul>
            </section>

            <section>
                <h3 className="font-bold text-xl text-slate-900 mb-3">3. Third-Party Services</h3>
                <p>We rely on trusted third-party providers:</p>
                <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Database:</strong> Used for secure storage.</li>
                    <li><strong>Google Auth:</strong> Used for secure sign-in.</li>
                    <li><strong>YouTube API:</strong> Used to display video content. We do not store your YouTube viewing history.</li>
                </ul>
            </section>

            <section>
                <h3 className="font-bold text-xl text-slate-900 mb-3">4. Data Retention & Deletion</h3>
                <p>We retain your data as long as your account is active. You may request full account deletion at any time by contacting support. Upon deletion, your personal data is removed, but anonymous prediction statistics may be retained for aggregate analysis.</p>
            </section>

            <section>
                <h3 className="font-bold text-xl text-slate-900 mb-3">5. Cookies</h3>
                <p>We use essential cookies to maintain your login session. We do not use third-party tracking cookies for advertising purposes.</p>
            </section>
        </div>
      </div>
    </div>
  );
}