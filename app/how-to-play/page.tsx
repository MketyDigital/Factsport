export const runtime = 'edge';

import Link from 'next/link';
import { ChevronLeft, Trophy, Target, Star, ShieldAlert } from 'lucide-react';

export default function HowToPlay() {
  return (
    <div className="min-h-screen bg-[#0a1428] text-white font-sans p-6 pb-24">
      <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 text-sm font-bold transition">
        <ChevronLeft size={16} /> Back to Home
      </Link>

      <h1 className="text-3xl font-black italic mb-2">HOW TO PLAY</h1>
      <p className="text-slate-400 text-sm mb-8">Master the rules to become the Monthly Champion.</p>

      <div className="space-y-6">
        
        {/* Step 1 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Target size={64} /></div>
            <h3 className="text-xl font-bold text-blue-400 mb-2">1. Predict Matches</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
                Before every match starts, submit your prediction. You must choose the <b>Winner</b> (Home/Draw/Away) AND the <b>Exact Score</b>.
            </p>
        </div>

        {/* Step 2 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Star size={64} /></div>
            <h3 className="text-xl font-bold text-yellow-400 mb-2">2. Earn Points</h3>
            <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-center gap-3">
                    <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded">3 PTS</span>
                    <span>For guessing the correct <b>Outcome</b> (e.g. Home Win).</span>
                </li>
                <li className="flex items-center gap-3">
                    <span className="bg-yellow-500 text-black text-[10px] font-black px-2 py-1 rounded">10 PTS</span>
                    <span>For guessing the <b>Exact Score</b> (e.g. 3-1).</span>
                </li>
            </ul>
        </div>

        {/* Step 3 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10"><Trophy size={64} /></div>
            <h3 className="text-xl font-bold text-green-400 mb-2">3. Win Prizes</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
                The leaderboard resets every month. To win 1st, 2nd, or 3rd place, you must meet the <b>VIP Criteria</b>:
            </p>
            <div className="bg-black/30 p-4 rounded-xl text-xs space-y-2 border border-white/5">
                <div className="flex justify-between"><span>🥇 1st Place</span> <span className="font-bold text-yellow-400">Highest Pts + 2 Correct Scores</span></div>
                <div className="flex justify-between"><span>🥈 2nd Place</span> <span className="font-bold text-slate-300">2nd Highest + 2 Correct Scores</span></div>
                <div className="flex justify-between"><span>🥉 3rd Place</span> <span className="font-bold text-orange-400">3rd Highest + 1 Correct Score</span></div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 italic">*Only VIP Members are eligible for ranking prizes.</p>
        </div>

      </div>

      <div className="mt-10 text-center">
        <Link href="/" className="bg-yellow-500 text-black font-black py-4 px-8 rounded-xl shadow-lg active:scale-95 transition inline-block w-full">
            START PREDICTING
        </Link>
      </div>
    </div>
  );
}