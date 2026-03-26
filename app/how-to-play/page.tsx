export const runtime = 'edge';

import Link from 'next/link';
import { ChevronLeft, Trophy, Target, Star, ShieldAlert, Zap, Flame, Info } from 'lucide-react';

export default function HowToPlay() {
  return (
    <div className="min-h-screen bg-[#0a1428] text-white font-sans p-6 pb-24">
      <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 text-sm font-bold transition"
      >
        <ChevronLeft size={16} /> Back to Home
      </Link>

      <h1 className="text-3xl font-black italic mb-2">HOW TO PLAY</h1>
      <p className="text-slate-400 text-sm mb-8">Master the rules to become the Global Champion.</p>

      <div className="space-y-6">
        
        {/* Step 1 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Target size={64} />
            </div>
            <h3 className="text-xl font-bold text-blue-400 mb-2">1. Predict Matches</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
                Before every match starts, submit your prediction. You must choose the <b>Winner</b> (Home/Draw/Away) AND the <b>Exact Score</b>.
            </p>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300">
                <span className="font-bold text-blue-400">DAILY LIMIT:</span> Only your first 5 predictions per day count towards the leaderboard. Choose wisely!
            </div>
        </div>

        {/* Step 2 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Star size={64} />
            </div>
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
             <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Trophy size={64} />
             </div>
            <h3 className="text-xl font-bold text-green-400 mb-2">3. Monthly Prizes</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
                The leaderboard resets every month. To win 1st, 2nd, or 3rd place, you must meet the <b>VIP Criteria</b>:
            </p>
            <div className="bg-black/30 p-4 rounded-xl text-xs space-y-2 border border-white/5">
                <div className="flex justify-between">
                    <span>🥇 1st Place</span> 
                    <span className="font-bold text-yellow-400">Highest Pts + 4 Exact Scores</span>
                </div>
                <div className="flex justify-between">
                    <span>🥈 2nd Place</span> 
                    <span className="font-bold text-slate-300">2nd Highest + 4 Exact Scores</span>
                </div>
                <div className="flex justify-between">
                    <span>🥉 3rd Place</span> 
                    <span className="font-bold text-orange-400">3rd Highest + 4 Exact Scores</span>
                </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 italic">*Only VIP Members are eligible for ranking prizes.</p>
        </div>

        {/* 🟢 NEW: SPECIAL CAMPAIGNS RULES & DATA CLAUSE */}
        <div className="bg-gradient-to-br from-orange-900/30 to-amber-900/10 border border-orange-500/30 rounded-2xl p-6 relative overflow-hidden mt-8">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Zap size={64} className="text-orange-400" />
             </div>
            <h3 className="text-xl font-bold text-orange-400 mb-2 flex items-center gap-2">
                ⚡ Special Tournaments
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4 pr-8">
                During major events (World Cups, Finals, Weekend Giveaways), we launch Special Tournaments with independent leaderboards and massive point multipliers!
            </p>
            
            <ul className="space-y-4 text-xs text-slate-300">
                <li className="flex items-start gap-3">
                    <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-1 rounded shrink-0">BONUS</span>
                    <span><b>Unlock Markets:</b> Predict First Goalscorer, Red Cards, and Penalties. Goalscorer markets unlock ~1 hour before kickoff when official squads are announced.</span>
                </li>
                <li className="flex items-start gap-3">
                    <span className="bg-slate-700 text-white text-[10px] font-black px-2 py-1 rounded shrink-0">OPTIONAL</span>
                    <span><b>Skip the Score:</b> In some tournaments, Exact Score is optional. You can just pick the Winner, but you sacrifice the massive points!</span>
                </li>
            </ul>

            <div className="mt-5 bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 flex items-start gap-2">
                <Info size={14} className="text-orange-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-orange-200 leading-relaxed italic">
                    <b>Official Data Rule:</b> All bonus markets are settled automatically based strictly on our official live match data at the time of the final whistle. If a specific event (e.g., a Red Card) is not recorded in the official match data, it is legally deemed to have not occurred for settlement purposes.
                </p>
            </div>

            <div className="mt-6 border-t border-orange-500/20 pt-4">
                <h4 className="text-sm font-black text-orange-300 mb-2 flex items-center gap-1">
                    <Flame size={14}/> Campaign Winner Criteria
                </h4>
                <ul className="space-y-2 text-[11px] text-slate-300">
                    <li><span className="text-orange-400">●</span> <b>Top Points:</b> Finish #1 on the isolated Campaign Leaderboard.</li>
                    <li><span className="text-orange-400">●</span> <b>The Sniper:</b> You must have hit at least ONE Exact Score during the campaign.</li>
                    <li><span className="text-orange-400">●</span> <b>The Specialist:</b> You must have correctly predicted at least ONE Bonus Market (Scorer/Cards/Penalty).</li>
                </ul>
            </div>
        </div>

        {/* The Champion's Checklist */}
        <div className="bg-gradient-to-br from-purple-900/30 to-[#0a1428] border border-purple-500/30 rounded-2xl p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                 <ShieldAlert size={64} className="text-purple-400" />
             </div>
            <h3 className="text-xl font-bold text-purple-400 mb-2 flex items-center gap-2">
                🏆 Champion's Audit
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4 pr-8">
                To claim your Monthly VIP cash prize, your predictions must pass the ultimate test. You must meet <b>ALL</b> of these conditions:
            </p>
            
            <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">●</span>
                    <span><b>100-Point Floor:</b> Score a minimum of 100 total points in the month.</span>
                </li>
                <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">●</span>
                    <span><b>Active Player:</b> Place predictions in at least 3 different weeks.</span>
                </li>
                <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">●</span>
                    <span><b>4-League Master:</b> Your 4 Exact Scores must come from 4 different leagues.</span>
                </li>
                <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">●</span>
                    <span><b>The Perfect Mix:</b> Include at least 1 Home Win, 1 Away Win, and 1 Draw Exact Score.</span>
                </li>
                <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">●</span>
                    <span><b>Scoreline Variety:</b> Exact scores cannot all be identical, and a max of one "0-0" counts.</span>
                </li>
            </ul>
        </div>

      </div>

      <div className="mt-10 text-center">
        <Link 
            href="/matches" 
            className="bg-yellow-500 text-black font-black py-4 px-8 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_30px_rgba(234,179,8,0.5)] active:scale-95 transition inline-block w-full"
        >
            START PREDICTING
        </Link>
      </div>
    </div>
  );
}