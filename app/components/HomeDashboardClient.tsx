'use client';
import { useState, useEffect } from 'react';
import Link from "next/link";
import { ArrowRight, TrendingUp, Calendar, Info } from "lucide-react";
import HeroMatchCards from '@/app/components/HeroMatchCards'; 
import CompactMatchRow from '@/app/components/CompactMatchRow';
import BetOfTheDay from '@/app/components/BetOfTheDay'; 
import FreeTipsBanner from '@/app/components/FreeTipsBanner';

const LIVE_STATUSES = ['LIVE', 'IN_PLAY', 'IN', '1H', '2H', 'HT', 'HALFTIME', 'ET', 'EXTRA TIME', 'P', 'PENALTIES'];
const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

export default function HomeDashboardClient({ 
    globalMatches, 
    featuredMatches, 
    selectedLeague, 
    miniStandingsNode 
}: { 
    globalMatches: any[], featuredMatches: any[], selectedLeague?: string, miniStandingsNode: React.ReactNode 
}) {
    const [localData, setLocalData] = useState<any>(null);

    useEffect(() => {
        // 1. DETERMINE LOCAL MIDNIGHT TO MIDNIGHT
        const now = new Date();
        const startOfLocalDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
        const endOfLocalDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

        let displayPool = [];
        let fallbackTriggered = false;

        // 2. APPLY RULES BASED ON TAB
        if (selectedLeague) {
            // LEAGUE TAB LOGIC:
            // Does this league have matches TODAY in the user's timezone?
            const todayLeagueMatches = globalMatches.filter(m => {
                const matchTime = new Date(m.match_date).getTime();
                const isLive = LIVE_STATUSES.includes((m.status || '').toUpperCase());
                return isLive || (matchTime >= startOfLocalDay && matchTime <= endOfLocalDay);
            });

            if (todayLeagueMatches.length > 0) {
                displayPool = todayLeagueMatches.slice(0, 5); // Max 5
            } else {
                // FALLBACK: Tab is empty for today. Show the closest upcoming/past matches the server found.
                displayPool = globalMatches.slice(0, 5);
                fallbackTriggered = true;
            }
        } else {
            // FOR YOU TAB LOGIC:
            // Strictly Local Today matches across ALL leagues
            let localTodayMatches = globalMatches.filter(m => {
                const matchTime = new Date(m.match_date).getTime();
                const isLive = LIVE_STATUSES.includes((m.status || '').toUpperCase());
                return isLive || (matchTime >= startOfLocalDay && matchTime <= endOfLocalDay);
            });

            if (localTodayMatches.length === 0) {
                // Absolute Season Break fallback (if absolutely 0 matches globally today)
                localTodayMatches = globalMatches.slice(0, 10);
            }

            // Mix max 3 per league, up to 20
            const leagues: Record<string, any[]> = {};
            localTodayMatches.forEach(m => {
                if (!leagues[m.league]) leagues[m.league] = [];
                leagues[m.league].push(m);
            });

            const mixed: any[] = [];
            const counters: Record<string, number> = {};
            Object.keys(leagues).forEach(k => counters[k] = 0);

            let added = true;
            while (added && mixed.length < 20) {
                added = false;
                for (const league of Object.keys(leagues)) {
                    if (mixed.length >= 20) break;
                    if (counters[league] < 3 && leagues[league].length > 0) {
                        mixed.push(leagues[league].shift());
                        counters[league]++;
                        added = true;
                    }
                }
                // Loosen constraint if we need more matches to hit 20
                if (!added && mixed.length < 20 && localTodayMatches.length > mixed.length) {
                    for (const league of Object.keys(leagues)) {
                        if (mixed.length >= 20) break;
                        if (leagues[league].length > 0) {
                            mixed.push(leagues[league].shift());
                            added = true;
                        }
                    }
                }
            }
            displayPool = mixed;
        }

        // 3. COMPUTE HERO MATCHES (Admin -> Media -> Big Teams -> Any) Max 5
        let computedHero: any[] = [...featuredMatches.filter(m => {
            const t = new Date(m.match_date).getTime();
            return t >= startOfLocalDay && t <= endOfLocalDay;
        })];
        
        // Filter media to Local Today
        const todayMedia = globalMatches.filter(m => {
            const t = new Date(m.match_date).getTime();
            return t >= startOfLocalDay && t <= endOfLocalDay;
        });

        const mediaMatches = todayMedia.filter(m => m.livestream_url || m.audio_url || m.video_url);
        mediaMatches.forEach(m => { if (!computedHero.find(h => h.id === m.id) && computedHero.length < 5) computedHero.push(m); });

        if (computedHero.length < 5) {
            const bigTeams = ['Arsenal', 'Chelsea', 'Liverpool', 'Man City', 'Manchester City', 'Man United', 'Manchester United', 'Tottenham', 'Real Madrid', 'Barcelona', 'Atletico', 'Bayern', 'Dortmund', 'Leverkusen', 'Juventus', 'Inter', 'AC Milan', 'Napoli', 'PSG'];
            const activeMatches = todayMedia.filter(m => !FINISHED_STATUSES.includes((m.status || '').toUpperCase()));
            const candidates = activeMatches.length > 0 ? activeMatches : todayMedia;
            
            const bigMatches = candidates.filter(m => { return bigTeams.some(giant => (m.home_team && m.home_team.toLowerCase().includes(giant.toLowerCase())) || (m.away_team && m.away_team.toLowerCase().includes(giant.toLowerCase()))); });
            bigMatches.forEach(m => { if (!computedHero.find(h => h.id === m.id) && computedHero.length < 5) computedHero.push(m); });
            candidates.forEach(m => { if (!computedHero.find(h => h.id === m.id) && computedHero.length < 5) computedHero.push(m); });
        }
        computedHero = computedHero.slice(0, 5);

        // 4. COMPUTE BET OF THE DAY (Latest big match of local today)
        let computedBetMatch = null;
        if (todayMedia.length > 0) {
            if (featuredMatches.length > 0) {
                computedBetMatch = featuredMatches[featuredMatches.length - 1]; 
            } else {
                const sortedByTimeDesc = [...todayMedia].sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());
                const bigTeams = ['Arsenal', 'Chelsea', 'Liverpool', 'Man City', 'Manchester City', 'Man United', 'Manchester United', 'Tottenham', 'Real Madrid', 'Barcelona', 'Atletico', 'Bayern', 'Dortmund', 'Leverkusen', 'Juventus', 'Inter', 'AC Milan', 'Napoli', 'PSG'];
                const latestBigMatch = sortedByTimeDesc.find(m => bigTeams.some(giant => (m.home_team && m.home_team.toLowerCase().includes(giant.toLowerCase())) || (m.away_team && m.away_team.toLowerCase().includes(giant.toLowerCase()))));
                computedBetMatch = latestBigMatch || sortedByTimeDesc[0];
            }
        } else if (globalMatches.length > 0) {
            computedBetMatch = globalMatches[0]; // Absolute fallback if no matches today
        }

        // 5. GROUP MATCHES
        const remainingMatches = displayPool.filter(m => !computedHero.some(h => h.id === m.id));
        const grouped: Record<string, any[]> = {};
        remainingMatches.forEach(m => {
            const dateKey = new Date(m.match_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(m);
        });

        setLocalData({ heroMatches: computedHero, betMatch: computedBetMatch, groupedMatches: grouped, fallbackTriggered });
    }, [globalMatches, featuredMatches, selectedLeague]);

    if (!localData) return <div className="w-full h-64 animate-pulse bg-slate-200/50 rounded-2xl max-w-6xl mx-auto mt-8"></div>;

    return (
        <>
            {/* HERO CARDS */}
            {!selectedLeague && localData.heroMatches.length > 0 && (
                <div className="bg-[#0f1c3a] pt-3 pb-4 border-b border-slate-800">
                    <HeroMatchCards heroMatches={localData.heroMatches} />
                </div>
            )}

            {/* MATCH CENTER */}
            <section className="mt-8 max-w-6xl mx-auto">
                <div className="px-4 flex justify-between items-center mb-3">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2"><TrendingUp className="text-red-500" size={14}/> Match Center</h3>
                    <Link href="/matches" className="text-[10px] font-black bg-[#0a1428] text-white px-4 py-2 rounded-lg flex items-center gap-1 shadow-md active:scale-95 transition hover:bg-slate-900">
                        All Fixtures <ArrowRight size={10} />
                    </Link>
                </div>
                
                <div className="bg-white border-y border-slate-200 sticky top-0 z-30 overflow-x-auto scrollbar-hide py-2 shadow-sm mb-4">
                    <div className="flex px-4 space-x-2 min-w-max">
                    <Link href="/" scroll={false} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${!selectedLeague ? 'bg-[#0a1428] text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>For You</Link>
                    {['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Champions League'].map((league) => (
                        <Link key={league} href={`/?league=${league}`} scroll={false} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${selectedLeague === league ? 'bg-[#0a1428] text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>{league === 'Premier League' ? 'EPL' : league}</Link>
                    ))}
                    <Link href="/matches" className="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100">Others</Link>
                    </div>
                </div>

                {/* 🟢 DYNAMIC FALLBACK BANNER */}
                {selectedLeague && localData.fallbackTriggered && (
                    <div className="px-4 mb-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                            <div className="flex items-center gap-2 text-amber-800">
                                <Info size={16} className="text-amber-600 shrink-0" />
                                <p className="text-[10px] sm:text-xs font-bold">No fixtures for today. Showing nearest closest matches.</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="px-2 md:px-4 py-0 flex flex-col lg:flex-row gap-4 mt-2">
                    <div className="flex-1 space-y-4">
                        <FreeTipsBanner />

                        {Object.keys(localData.groupedMatches).length > 0 ? (
                            <>
                            {Object.keys(localData.groupedMatches).map((dateKey) => (
                                <div key={dateKey} className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
                                    <div className="bg-slate-50 px-3 py-2 md:py-2.5 border-b border-slate-200 flex items-center gap-2">
                                        <Calendar size={12} className="text-slate-400"/>
                                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">{dateKey}</span>
                                    </div>

                                    {/* 🟢 GLOBALLY FORCED 2-COLUMN GRID ON MOBILE */}
                                    <div className="grid grid-cols-2 gap-1.5 md:gap-2 p-1.5 md:p-2 bg-[#f8fafc]">
                                        {localData.groupedMatches[dateKey].map((match: any) => (
                                            <div key={match.id}>
                                                <CompactMatchRow match={match} disablePolling={false} showLeague={!selectedLeague} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            
                            <Link href="/matches" className="block w-full text-center bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest py-3.5 rounded-xl hover:bg-slate-50 hover:text-blue-600 transition shadow-sm mb-4">
                                View Full Fixtures <ArrowRight size={12} className="inline ml-1 -mt-0.5" />
                            </Link>
                            </>
                        ) : (
                            <div className="text-center py-16 px-4 bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
                                <Calendar size={32} className="mx-auto mb-3 text-slate-300"/>
                                <p className="text-sm font-black text-slate-700 mb-1">Season Break</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">No active fixtures found. Check back soon for the new schedule.</p>
                            </div>
                        )}
                    </div>

                    {/* CONDITIONAL MINI STANDINGS */}
                    {selectedLeague && (
                        <div className="w-full lg:w-80 shrink-0">
                            <div className="sticky top-[120px]">
                                {miniStandingsNode}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* 🟢 BET OF THE DAY */}
            {localData.betMatch && <div className="px-4"><BetOfTheDay initialMatch={localData.betMatch} /></div>}
        </>
    );
}