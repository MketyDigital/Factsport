import Link from 'next/link';
import { ChevronLeft, Lock } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F0F2F5] p-6 font-sans text-slate-800">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-6 text-sm font-bold transition">
            <ChevronLeft size={16} /> Back to Home
        </Link>
        
        <h1 className="text-2xl font-black uppercase mb-6 flex items-center gap-2">
            <Lock className="text-blue-600" /> Privacy Policy
        </h1>

        <div className="prose prose-slate prose-sm max-w-none space-y-4">
            <p className="text-xs text-slate-400">Last Updated: January 2024</p>
            
            <p>At FactSport, we take your privacy seriously. This policy explains how we handle your data.</p>

            <h3 className="font-bold text-slate-900">1. Information We Collect</h3>
            <ul className="list-disc pl-5">
                <li><strong>Account Data:</strong> When you sign up via Google, we store your email, name, and profile picture to create your account.</li>
                <li><strong>Usage Data:</strong> We track your predictions and points to update the leaderboard.</li>
                <li><strong>Cookies:</strong> We use essential cookies to keep you logged in.</li>
            </ul>

            <h3 className="font-bold text-slate-900">2. How We Use Your Data</h3>
            <p>We use your data solely to operate the game, rank you on the leaderboard, and process VIP upgrades. We do NOT sell your personal data to third parties.</p>

            <h3 className="font-bold text-slate-900">3. Third-Party Services</h3>
            <p>Our site uses Supabase for database services and Google Authentication for login. By using FactSport, you also agree to their respective privacy policies.</p>

            <h3 className="font-bold text-slate-900">4. Data Deletion</h3>
            <p>You have the right to request the deletion of your account at any time. Please contact support to have your data permanently removed.</p>
        </div>
      </div>
    </div>
  );
}