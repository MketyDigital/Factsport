export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    
    if (searchParams.get('key') !== process.env.CRON_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
        fromDate.setDate(today.getDate() - 2); 
        const toDate = new Date(today); 
        const fromStr = fromDate.toISOString().split('T')[0];
        const toStr = toDate.toISOString().split('T')[0];

        let matchesFinalized = 0; 
        let standingsUpdated = 0;
        let logs: string[] = [];
        const leaguesNeedingStandingsUpdate = new Set<string>();

        const res = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${fromStr}&dateTo=${toStr}`, { 
            headers: { 'X-Auth-Token': API_KEY } 
        });

        if (res.ok) {
            const data = await res.json();
            
            for (const m of data.matches || []) {
                const compCode = m.competition?.code;
                if (!TARGET_LEAGUES.includes(compCode)) continue;
                
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
                    .select('id, status, home_score, away_score, espn_id')
                    .eq('api_id', m.id)
                    .single();

                if (!dbMatch) continue;

                const isDbLive = ['LIVE', 'HT', '1H', '2H', 'ET', 'P'].includes(dbMatch.status);
                const hasEspnId = !!dbMatch.espn_id;
                
                const fdHomeScore = m.score?.fullTime?.home ?? 0;
                const fdAwayScore = m.score?.fullTime?.away ?? 0;
                let shouldUpdateMatch = false;

                // 🟢 FIXED SHIELD: Broaden the trigger window. If a match happened in our 48-hour 
                // fetch window and is finished or live, ALWAYS sync its league's standings.
                // This permanently solves the issue where FD delays their standings update and we miss it.
                if (['LIVE', 'HT', 'FT', 'FINISHED', 'AWARDED'].includes(fdStatusMapped) || isDbLive) {
                    leaguesNeedingStandingsUpdate.add(compCode);
                }

                // 🟢 THE MASTER SHIELD LOGIC
                if (fdStatusMapped === 'FT') {
                    // 1. Always audit and confirm FT scores
                    if (dbMatch.status !== 'FT' || dbMatch.home_score !== fdHomeScore || dbMatch.away_score !== fdAwayScore) {
                        shouldUpdateMatch = true;
                        leaguesNeedingStandingsUpdate.add(compCode); 
                    }
                } 
                else if (hasEspnId && (fdStatusMapped === 'LIVE' || fdStatusMapped === 'HT' || isDbLive)) {
                    // 2. If it has an ESPN ID and is currently playing, HANDS OFF! ESPN Worker handles it.
                    continue; 
                } 
                else if (!hasEspnId && ['LIVE', 'HT'].includes(fdStatusMapped)) {
                    // 3. THE FALLBACK: Match is live but you forgot the ESPN ID. Update from Football-Data.
                    if (dbMatch.status !== fdStatusMapped || dbMatch.home_score !== fdHomeScore || dbMatch.away_score !== fdAwayScore) {
                        shouldUpdateMatch = true;
                    }
                }
                else if (['POSTPONED', 'SCHEDULED'].includes(fdStatusMapped)) {
                    // 4. Handle postponements securely
                    if (dbMatch.status !== fdStatusMapped && !isDbLive) {
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
                    logs.push(`Cron Sync: ${m.id} (${compCode}) -> ${fdStatusMapped} ${fdHomeScore}-${fdAwayScore}`);
                }
            }
        }

        if (forceSync) {
            TARGET_LEAGUES.forEach(league => leaguesNeedingStandingsUpdate.add(league));
            logs.push("Admin forced a full standings sync.");
        }

        // 🟢 STANDINGS SYNC (Safe, delayed, and clean insert)
        for (const leagueId of Array.from(leaguesNeedingStandingsUpdate)) {
            if (leagueId === 'EC' || leagueId === 'WC') continue; 

            // Prevent Football-Data rate limiting (Edge friendly - max 10 requests per minute)
            await new Promise(resolve => setTimeout(resolve, 1500)); 

            const standRes = await fetch(`https://api.football-data.org/v4/competitions/${leagueId}/standings`, { 
                headers: { 'X-Auth-Token': API_KEY } 
            });
            
            if (!standRes.ok) continue;

            const standData = await standRes.json();
            // Ensure we are grabbing the 'TOTAL' standings, not HOME or AWAY splits
            const table = standData?.standings?.find((s: any) => s.type === 'TOTAL')?.table || [];

            if (table.length > 0) {
                const standingsToInsert = table.map((entry: any) => ({
                    league_code: leagueId,
                    position: entry.position,
                    team_id: entry.team.id,
                    team_name: entry.team.name,
                    team_short_name: entry.team.shortName || entry.team.name,
                    team_crest: entry.team.crest,
                    played_games: entry.playedGames,
                    won: entry.won,
                    draw: entry.draw,
                    lost: entry.lost,
                    goal_difference: entry.goalDifference,
                    points: entry.points,
                    updated_at: new Date().toISOString()
                }));

                // Safe approach: Wipe the old league data and insert perfectly fresh data to avoid conflicts
                await supabase.from('standings').delete().eq('league_code', leagueId);
                const { error: stdErr } = await supabase.from('standings').insert(standingsToInsert);
                
                if (!stdErr) {
                    standingsUpdated += table.length;
                    logs.push(`Standings Updated: ${leagueId}`);
                } else {
                    logs.push(`Standings Error (${leagueId}): ${stdErr.message}`);
                }
            }
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