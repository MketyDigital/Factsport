export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getTeamSearchVariations } from '@/app/lib/teamAliases';
import { fetchLiveMatchDeduplicated } from '@/app/utils/liveFetcher';

const VIP_LEAGUES = ['English Premier League', 'UEFA Champions League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'World Cup', 'Euro', 'Copa America'];
const VIP_TEAMS = [
    'Arsenal', 'Chelsea', 'Liverpool', 'Manchester City', 'Manchester United', 'Tottenham Hotspur',
    'Real Madrid', 'Barcelona', 'Atletico Madrid', 'Bayern Munich', 'Borussia Dortmund',
    'Juventus', 'AC Milan', 'Inter Milan', 'Napoli', 'Paris Saint Germain',
    // National Teams
    'Argentina', 'Brazil', 'France', 'England', 'Spain', 'Germany', 'Italy', 'Portugal', 'Netherlands', 'Belgium', 'USA', 'Mexico'
];

const isVipMatch = (match: any) => {
    if (VIP_LEAGUES.some(l => match.league?.includes(l))) return true;
    const hVars = getTeamSearchVariations(match.home_team);
    const aVars = getTeamSearchVariations(match.away_team);
    return VIP_TEAMS.some(vip => hVars.includes(vip.toLowerCase()) || aVars.includes(vip.toLowerCase()));
};

export async function GET(request: Request) { return processSocialEvents(request); }
export async function POST(request: Request) { return processSocialEvents(request); }

async function processSocialEvents(request: Request) {
    const url = new URL(request.url);
    if (url.searchParams.get('key') !== process.env.CRON_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    try {
        const { data: activeMatches, error } = await supabase
            .from('matches')
            .select('*')
            .not('espn_id', 'is', null)
            .in('status', ['pre', 'LIVE', 'IN_PLAY', 'IN', '1H', '2H', 'HT', 'HALFTIME']);

        if (error) throw error;
        if (!activeMatches?.length) return NextResponse.json({ message: "No active matches for social." });

        const logs: string[] = [];
        
        for (const dbMatch of activeMatches) {
            if (!isVipMatch(dbMatch)) continue; // Only process VIPs to save quota/spam

            try {
                const liveData = await fetchLiveMatchDeduplicated(dbMatch.espn_id);
                if (!liveData || liveData.error) continue;

                // 1. Lineup Detection
                if (liveData.home_lineup?.length > 0 && liveData.away_lineup?.length > 0) {
                    const lineupKey = `lineup_${dbMatch.id}`;
                    if (!dbMatch.social_events?.includes(lineupKey)) {
                        await triggerWebhook(dbMatch, 'lineups', liveData);
                        await markEvent(supabase, dbMatch.id, dbMatch.social_events, lineupKey);
                        logs.push(`Lineups triggered for ${dbMatch.home_team} vs ${dbMatch.away_team}`);
                    }
                }

                // 2. Goal Detection
                const currentTotalGoals = (liveData.home_score || 0) + (liveData.away_score || 0);
                const dbTotalGoals = (dbMatch.home_score || 0) + (dbMatch.away_score || 0);
                
                if (currentTotalGoals > dbTotalGoals) {
                    // Extract latest goal event from liveData.events
                    const latestGoal = liveData.events?.reverse().find((e:any) => e.type === 'goal' || e.text?.toLowerCase().includes('goal'));
                    const goalKey = `goal_${dbMatch.id}_${currentTotalGoals}`;
                    
                    if (!dbMatch.social_events?.includes(goalKey)) {
                        await triggerWebhook(dbMatch, 'goal', liveData, latestGoal);
                        await markEvent(supabase, dbMatch.id, dbMatch.social_events, goalKey);
                        logs.push(`Goal triggered for ${dbMatch.home_team} vs ${dbMatch.away_team} (${liveData.home_score}-${liveData.away_score})`);
                    }
                }

                // 3. Status Changes (HT, FT)
                const status = liveData.status.toUpperCase();
                if (['HT', 'HALFTIME'].includes(status)) {
                    const htKey = `ht_${dbMatch.id}`;
                    if (!dbMatch.social_events?.includes(htKey)) {
                        await triggerWebhook(dbMatch, 'halftime', liveData);
                        await markEvent(supabase, dbMatch.id, dbMatch.social_events, htKey);
                        logs.push(`HT triggered for ${dbMatch.home_team} vs ${dbMatch.away_team}`);
                    }
                }

                if (['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME'].includes(status)) {
                    const ftKey = `ft_${dbMatch.id}`;
                    if (!dbMatch.social_events?.includes(ftKey)) {
                        await triggerWebhook(dbMatch, 'fulltime', liveData);
                        await markEvent(supabase, dbMatch.id, dbMatch.social_events, ftKey);
                        logs.push(`FT triggered for ${dbMatch.home_team} vs ${dbMatch.away_team}`);
                    }
                }

            } catch (err) {
                console.error(`Error processing social for match ${dbMatch.id}:`, err);
            }
        }

        return NextResponse.json({ success: true, logs });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

async function markEvent(supabase: any, matchId: string, existingEvents: string[], newEvent: string) {
    const updatedEvents = [...(existingEvents || []), newEvent];
    await supabase.from('matches').update({ social_events: updatedEvents }).eq('id', matchId);
}

async function triggerWebhook(match: any, type: string, liveData: any, eventData: any = null) {
    const webhookUrl = process.env.MAKE_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type,
                match_id: match.id,
                home_team: match.home_team,
                away_team: match.away_team,
                home_score: liveData.home_score,
                away_score: liveData.away_score,
                clock: liveData.displayClock,
                league: match.league,
                event_details: eventData,
                timestamp: new Date().toISOString()
            })
        });
    } catch (e) {
        console.error("Webhook failed:", e);
    }
}
