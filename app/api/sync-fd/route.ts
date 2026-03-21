export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    
    // Security Check
    if (searchParams.get('key') !== process.env.CRON_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin Override (Updates all tables regardless of finished matches)
    const forceSync = searchParams.get('force') === 'true';

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!, 
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const API_KEY = process.env.FOOTBALL_DATA_KEY;
    if (!API_KEY) return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });

    const TARGET_LEAGUES = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'CL', 'EC', 'WC'];

    try {
        const today = new Date();
        const fromDate = new Date(today); 
        fromDate.setDate(today.getDate() - 2); // Look back 2 days
        const toDate = new Date(today); 
        const fromStr = fromDate.toISOString().split('T')[0];
        const toStr = toDate.toISOString().split('T')[0];

        let matchesFinalized = 0; 
        let standingsUpdated = 0;
        let logs: string[] = [];
        const leaguesNeedingStandingsUpdate = new Set<string>();

        // 🟢 PHASE 1: Fetch all matches from the last 2 days
        const res = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${fromStr}&dateTo=${toStr}`, { 
            headers: { 'X-Auth-Token': API_KEY } 
        });

        if (res.ok) {
            const data = await res.json();
            
            for (const m of data.matches || []) {
                const compCode = m.competition?.code;
                if (!TARGET_LEAGUES.includes(compCode)) continue;
                
                // Map the Football-Data Status
                let fdStatusMapped = 'SCHEDULED';
                if (['FINISHED', 'AWARDED'].includes(m.status)) {
                    fdStatusMapped = 'FT';
                } else if (['IN_PLAY', 'PAUSED'].includes(m.status)) {
                    fdStatusMapped = m.status === 'PAUSED' ? 'HT' : 'LIVE';
                } else if (['POSTPONED', 'CANCELLED', 'SUSPENDED'].includes(m.status)) {
                    fdStatusMapped = 'POSTPONED';
                } else {
                    fdStatusMapped = m.status;
                }
                
                const { data: dbMatch } = await supabase
                    .from('matches')
                    .select('id, status, home_score, away_score')
                    .eq('api_id', m.id)
                    .single();

                if (!dbMatch) continue;

                // 🛑 THE SHIELD: If the match is LIVE or HT in our DB, we SKIP it.
                // This prevents the "Time Travel" bug (delayed API overwriting live ESPN scores).
                const isCurrentlyLiveInDB = ['LIVE', 'HT', '1H', '2H', 'ET', 'P'].includes(dbMatch.status);
                if (isCurrentlyLiveInDB && fdStatusMapped !== 'FT') {
                    continue; // Do nothing, let ESPN Worker handle it
                }

                const fdHomeScore = m.score?.fullTime?.home ?? 0;
                const fdAwayScore = m.score?.fullTime?.away ?? 0;
                let shouldUpdateMatch = false;

                // 🟢 THE ORIGINAL FINISHED MATCH LOGIC
                if (fdStatusMapped === 'FT') {
                    if (dbMatch.status !== 'FT') {
                        shouldUpdateMatch = true;
                        leaguesNeedingStandingsUpdate.add(compCode); // Trigger table update
                    } else if (dbMatch.home_score !== fdHomeScore || dbMatch.away_score !== fdAwayScore) {
                        shouldUpdateMatch = true; // Score correction/audit
                        leaguesNeedingStandingsUpdate.add(compCode); // Retrigger table update for accuracy
                    }
                } 
                // Handle Postponements or TBD updates only if match isn't live
                else if (fdStatusMapped === 'POSTPONED' || fdStatusMapped === 'SCHEDULED') {
                    if (dbMatch.status !== fdStatusMapped && !isCurrentlyLiveInDB) {
                        shouldUpdateMatch = true;
                    }
                }

                if (shouldUpdateMatch) {
                    await supabase.from('matches').update({ 
                        home_score: fdHomeScore, 
                        away_score: fdAwayScore, 
                        status: fdStatusMapped, 
                        updated_at: new Date().toISOString() 
                    }).eq('api_id', m.id);
                    
                    matchesFinalized++; 
                    logs.push(`Verified FT: Match ${m.id} (${compCode}) finalized at ${fdHomeScore}-${fdAwayScore}`);
                }
            }
        }

        // 🟢 THE ADMIN OVERRIDE
        if (forceSync) {
            TARGET_LEAGUES.forEach(league => leaguesNeedingStandingsUpdate.add(league));
            logs.push("Admin forced a full standings sync.");
        }

        // 🟢 PHASE 2: STANDINGS SYNC (Only for leagues where a match just finished)
        for (const leagueId of Array.from(leaguesNeedingStandingsUpdate)) {
            if (leagueId === 'EC' || leagueId === 'WC') continue; 

            // 1.5s delay to avoid API Rate Limits
            await new Promise(resolve => setTimeout(resolve, 1500)); 

            const standRes = await fetch(`https://api.football-data.org/v4/competitions/${leagueId}/standings`, { 
                headers: { 'X-Auth-Token': API_KEY } 
            });
            
            if (!standRes.ok) continue;

            const standData = await standRes.json();
            const table = standData?.standings?.[0]?.table || [];

            for (const entry of table) {
                await supabase.from('standings').upsert({
                    league_code: leagueId,
                    position: entry.position,
                    team_id: entry.team.id,
                    team_name: entry.team.name,
                    team_short_name: entry.team.shortName,
                    team_crest: entry.team.crest,
                    played_games: entry.playedGames,
                    won: entry.won,
                    draw: entry.draw,
                    lost: entry.lost,
                    goal_difference: entry.goalDifference,
                    points: entry.points,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'league_code, team_id' });
                standingsUpdated++;
            }
            logs.push(`Standings Updated: ${leagueId}`);
        }

        return NextResponse.json({ 
            success: true, 
            matchesVerified: matchesFinalized, 
            standingsUpdated, 
            leaguesTriggered: Array.from(leaguesNeedingStandingsUpdate),
            logs 
        });

    } catch (error: any) { 
        return NextResponse.json({ error: error.message }, { status: 500 }); 
    }
}