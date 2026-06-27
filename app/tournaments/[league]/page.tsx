export const runtime = 'edge';
export const revalidate = 60;

import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Trophy, Calendar, CheckCircle, MapPin } from 'lucide-react';
import CompactMatchRow from '@/app/components/CompactMatchRow';
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';

export async function generateMetadata({ params }: { params: { league: string } }) {
    const resolvedParams = await params;
    const leagueName = decodeURIComponent(resolvedParams.league);
    return {
        title: `${leagueName} Live Hub | FactSport`,
        description: `Follow the ${leagueName} with live scores, group standings, knockout brackets, and expert predictions.`
    };
}

export default async function TournamentHubPage({ params }: { params: { league: string } }) {
    const resolvedParams = await params;
    const leagueName = decodeURIComponent(resolvedParams.league);
    
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    // 1. Fetch Matches
    const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .eq('league', leagueName)
        .order('match_date', { ascending: true });

    if (!matches || matches.length === 0) {
        return notFound();
    }

    // 2. Fetch Standings (Groups)
    const { data: standings } = await supabase
        .from('standings')
        .select('*')
        .eq('league_code', leagueName === 'World Cup' ? 'WC' : leagueName === 'Euros' ? 'EC' : leagueName === 'Champions League' ? 'CL' : 'PL')
        .order('group_name', { ascending: true })
        .order('position', { ascending: true });

    const groupedStandings: Record<string, any[]> = {};
    if (standings) {
        standings.forEach((s: any) => {
            const g = s.group_name || 'League';
            if (!groupedStandings[g]) groupedStandings[g] = [];
            groupedStandings[g].push(s);
        });
    }

    // Categorize Matches
    const now = new Date().getTime();
    const liveMatches = matches.filter(m => ['LIVE', 'HT', 'IN_PLAY', '1H', '2H', 'ET', 'P'].includes((m.status || '').toUpperCase()));
    const upcomingMatches = matches.filter(m => ['SCHEDULED', 'PRE', 'TBD'].includes((m.status || '').toUpperCase())).slice(0, 10);
    const recentResults = matches.filter(m => ['FT', 'FINISHED', 'AET', 'PEN'].includes((m.status || '').toUpperCase())).reverse().slice(0, 10);

    // Group Knockout Matches
    const knockoutMatches = matches.filter(m => m.stage && (m.stage.toLowerCase().includes('round of') || m.stage.toLowerCase().includes('quarter') || m.stage.toLowerCase().includes('semi') || m.stage.toLowerCase().includes('final')));
    const groupedKnockouts: Record<string, any[]> = {};
    knockoutMatches.forEach(m => {
        const stage = m.stage || 'Knockout';
        if (!groupedKnockouts[stage]) groupedKnockouts[stage] = [];
        groupedKnockouts[stage].push(m);
    });

    return (
        <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-20 font-sans">
            
            {/* Header */}
            <div className="bg-[#0a1428] text-white p-4 sticky top-0 z-50 shadow-lg flex items-center gap-4">
                <Link href="/" className="p-1.5 bg-white/10 rounded-full hover:bg-white/20 transition">
                    <ChevronLeft size={20} />
                </Link>
                <div>
                    <h1 className="font-black text-lg uppercase tracking-wider flex items-center gap-2">
                        <Trophy className="text-yellow-500" size={20} /> {leagueName} Hub
                    </h1>
                    <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-0.5">LIVE SCORES, GROUPS & KNOCKOUTS</p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto p-4 space-y-6">
                <AdsterraStandardBanner />

                {/* Live & Upcoming */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                            <h2 className="font-black text-xs uppercase tracking-widest text-slate-700">Live & Next Matches</h2>
                        </div>
                        <div className="p-2 space-y-2">
                            {liveMatches.length > 0 ? liveMatches.map(m => <CompactMatchRow key={m.id} match={m} />) : null}
                            {upcomingMatches.map(m => <CompactMatchRow key={m.id} match={m} />)}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center gap-2">
                            <CheckCircle size={14} className="text-green-500" />
                            <h2 className="font-black text-xs uppercase tracking-widest text-slate-700">Recent Results</h2>
                        </div>
                        <div className="p-2 space-y-2">
                            {recentResults.map(m => <CompactMatchRow key={m.id} match={m} />)}
                        </div>
                    </div>
                </div>

                {/* Knockout Stages */}
                {Object.keys(groupedKnockouts).length > 0 && (
                    <div>
                        <h2 className="font-black text-sm uppercase tracking-widest text-slate-800 mb-4 flex items-center gap-2">
                            <Trophy size={16} className="text-blue-600" /> Knockout Stages
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {Object.keys(groupedKnockouts).map(stage => (
                                <div key={stage} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="bg-blue-600 text-white p-2 text-center font-black text-[10px] uppercase tracking-widest">
                                        {stage.replace(/_/g, ' ')}
                                    </div>
                                    <div className="p-2 space-y-2">
                                        {groupedKnockouts[stage].map(m => <CompactMatchRow key={m.id} match={m} />)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Group Standings */}
                {Object.keys(groupedStandings).length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-black text-sm uppercase tracking-widest text-slate-800 flex items-center gap-2">
                                <MapPin size={16} className="text-red-500" /> Group Stages
                            </h2>
                            <Link href={`/standings?league=${encodeURIComponent(leagueName)}`} className="text-[10px] font-bold text-blue-600 hover:underline">
                                View Full Tables
                            </Link>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {Object.keys(groupedStandings).map(groupKey => (
                                <div key={groupKey} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="bg-slate-800 text-white p-2 text-center font-black text-[10px] uppercase tracking-widest">
                                        {groupKey}
                                    </div>
                                    <table className="w-full text-[10px]">
                                        <thead className="bg-slate-50 text-slate-400 font-bold">
                                            <tr>
                                                <th className="p-1.5 text-left w-6">#</th>
                                                <th className="p-1.5 text-left">Team</th>
                                                <th className="p-1.5 text-center w-6">P</th>
                                                <th className="p-1.5 text-center w-6">GD</th>
                                                <th className="p-1.5 text-center w-8 text-slate-800">Pts</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {groupedStandings[groupKey].map((team: any, idx: number) => (
                                                <tr key={team.team.id} className={idx < 2 ? 'bg-blue-50/30' : ''}>
                                                    <td className="p-1.5 font-bold text-slate-500">{team.position}</td>
                                                    <td className="p-1.5 font-black text-slate-800 flex items-center gap-1.5">
                                                        {team.team.crest && <img src={team.team.crest} className="w-3 h-3 object-contain" alt="" />}
                                                        <span className="truncate max-w-[80px]">{team.team.shortName}</span>
                                                    </td>
                                                    <td className="p-1.5 text-center text-slate-500">{team.playedGames}</td>
                                                    <td className="p-1.5 text-center text-slate-500">{team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}</td>
                                                    <td className="p-1.5 text-center font-black text-slate-900">{team.points}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
