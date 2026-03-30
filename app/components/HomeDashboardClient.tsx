'use client';
import { useState, useEffect } from 'react';
import Link from "next/link";
import { ArrowRight, TrendingUp, Calendar, Info, BarChart2 } from "lucide-react";
import HeroMatchCards from '@/app/components/HeroMatchCards'; 
import CompactMatchRow from '@/app/components/CompactMatchRow';
import BetOfTheDay from '@/app/components/BetOfTheDay'; 
import FreeTipsBanner from '@/app/components/FreeTipsBanner';

const LIVE_STATUSES = ['LIVE', 'IN_PLAY', 'IN', '1H', '2H', 'HT', 'HALFTIME', 'ET', 'EXTRA TIME', 'P', 'PENALTIES'];
const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

export default function HomeDashboardClient({ 
    globalMatches, featuredMatches, selectedLeague, headlinesNode, installBannerNode, latestNewsNode, miniStandingsNode 
}: { 
    globalMatches: any[], featuredMatches: any[], selectedLeague?: string, 
    headlinesNode: React.ReactNode, installBannerNode: React.ReactNode, latestNewsNode: React.ReactNode, miniStandingsNode: React.ReactNode 
}) {
    const [localData, setLocalData] = useState<any>(null);
    const [leagueTab, setLeagueTab] = useState<'matches'|'table'>('matches');

    useEffect(() => { setLeagueTab('matches'); }, [selectedLeague]);

    useEffect(() => {
        const now = new Date();
        const startOfLocalDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
        const endOfLocalDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

        let displayPool = [];
        let fallbackTriggered = false;

        if (selectedLeague) {
            const todayLeagueMatches = globalMatches.filter(m => {
                const matchTime = new Date(m.match_date).getTime();
                const isLive = LIVE_STATUSES.includes((m.status || '').toUpperCase());
                return isLive || (matchTime >= startOfLocalDay && matchTime <= endOfLocalDay);
            });
            if (todayLeagueMatches.length > 0) {
                displayPool = todayLeagueMatches.slice(0, 5); 
            } else {
                displayPool = globalMatches.slice(0, 5);
                fallbackTriggered = true;
            }
        } else {
            let localTodayMatches = globalMatches.filter(m => {
                const matchTime = new Date(m.match_date).getTime();
                const isLive = LIVE_STATUSES.includes((m.status || '').toUpperCase());
                return isLive || (matchTime >= startOfLocalDay && matchTime <= endOfLocalDay);
            });
            if (localTodayMatches.length === 0) localTodayMatches = globalMatches.slice(0, 10);
            
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

        let computedHero: any[] = [...featuredMatches.filter(m => {
            const t = new Date(m.match_date).getTime();
            return t >= startOfLocalDay && t <= endOfLocalDay;
        })];
        
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
        
        if (computedHero.length === 0) computedHero = globalMatches.slice(0, 5);
        computedHero = computedHero.slice(0, 5);

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
            computedBetMatch = globalMatches[0]; 
        }

        let remainingMatches = displayPool.filter(m => !computedHero.some(h => h.id === m.id));
        
        // 🟢 THE FIX: If Hero Cards ate all the matches, show them in the match center anyway so it's not empty!
        if (remainingMatches.length === 0 && displayPool.length > 0) {
            remainingMatches = displayPool;
        }

        const grouped: Record<string, any[]> = {};
        remainingMatches.forEach(m => {
            const dateKey = new Date(m.match_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(m);
        });

        setLocalData({ heroMatches: computedHero, betMatch: computedBetMatch, groupedMatches: grouped, fallbackTriggered });
    }, [globalMatches, featuredMatches, selectedLeague]);

    if (!localData) return <div className="w-full h-96 animate-pulse bg-slate-200/50 rounded-2xl max-w-6xl mx-auto mt-8"></div>;

    return (
        <>
            {!selectedLeague && localData.heroMatches.length > 0 && <HeroMatchCards heroMatches={localData.heroMatches} />}

            {/* 🟢 THE FIX: Exact requested node ordering */}
            {headlinesNode}
            {installBannerNode}
            {latestNewsNode}

            <section className="mt-6 max-w-6xl mx-auto">
                <div className="px-4 flex justify-between items-center mb-3">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2"><TrendingUp className="text-red-500" size={14}/> Match Center</h3>
                    <Link href="/matches" className="text-[10px] font-black bg-[#0a1428] text-white px-4 py-2 rounded-lg flex items-center gap-1 shadow-md active:scale-95 transition hover:bg-slate-900">
                        All Fixtures <ArrowRight size={10} />
                    </Link>
                </div>
                
                <div className="bg-white border-y border-slate-200 sticky top-0 z-30 overflow-x-auto scrollbar-hide py-2 shadow-sm mb-3">
                    <div className="flex px-3 space-x-2 min-w-max">
                        <Link href="/" scroll={false} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${!selectedLeague ? 'bg-[#0a1428] text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>For You</Link>
                        {['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Champions League'].map((league) => (
                            <Link key={league} href={`/?league=${league}`} scroll={false} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${selectedLeague === league ? 'bg-[#0a1428] text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>{league === 'Premier League' ? 'EPL' : league}</Link>
                        ))}
                    </div>
                </div>

                {selectedLeague && (
                    <div className="mx-3 mb-4 bg-slate-100 p-1 rounded-lg flex shadow-inner">
                        <button onClick={() => setLeagueTab('matches')} className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${leagueTab === 'matches' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Matches</button>
                        <button onClick={() => setLeagueTab('table')} className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all flex items-center justify-center gap-1 ${leagueTab === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><BarChart2 size={12}/> Standings</button>
                    </div>
                )}

                <div className="px-2 md:px-4 py-0 flex flex-col lg:flex-row gap-4 mt-2">
                    <div className="flex-1 space-y-3">
                        <FreeTipsBanner />

                        {leagueTab === 'matches' ? (
                            <>
                                {selectedLeague && localData.fallbackTriggered && (
                                    <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-2.5 shadow-sm">
                                        <p className="text-[10px] text-amber-800 font-bold flex items-center gap-1.5"><Info size={14} className="text-amber-600" /> No upcoming fixtures. Showing nearest results.</p>
                                    </div>
                                )}

                                {Object.keys(localData.groupedMatches).length > 0 ? (
                                    <>
                                    {Object.keys(localData.groupedMatches).map((dateKey) => (
                                        <div key={dateKey} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-3">
                                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center gap-2">
                                                <Calendar size={10} className="text-slate-400"/>
                                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-wider">{dateKey}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-1 p-1 bg-[#f8fafc]">
                                                {localData.groupedMatches[dateKey].map((match: any) => (
                                                    <div key={match.id}>
                                                        <CompactMatchRow match={match} disablePolling={false} showLeague={!selectedLeague} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    <Link href="/matches" className="block w-full text-center bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest py-3 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition shadow-sm mb-4">
                                        View Full Fixtures <ArrowRight size={12} className="inline ml-1 -mt-0.5" />
                                    </Link>
                                    </>
                                ) : (
                                    <div className="text-center py-10 px-4 bg-white rounded-xl border border-dashed border-slate-300 shadow-sm">
                                        <Calendar size={24} className="mx-auto mb-2 text-slate-300"/>
                                        <p className="text-xs font-black text-slate-700 mb-1">Season Break</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="w-full animation-fade-in">
                                {miniStandingsNode}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {localData.betMatch && <div className="px-3 md:px-4"><BetOfTheDay initialMatch={localData.betMatch} /></div>}
        </>
    );
}