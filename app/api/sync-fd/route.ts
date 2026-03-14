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

  // 🟢 THE SECRET OVERRIDE: ?force=true
  const forceSync = searchParams.get('force') === 'true';

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const API_KEY = process.env.FOOTBALL_DATA_KEY;
  if (!API_KEY) return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });

  // Array of string codes for easier filtering
  const TARGET_LEAGUES = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'CL', 'EC', 'WC'];

  try {
    const today = new Date();
    const fromDate = new Date(today); fromDate.setDate(today.getDate() - 2);
    const toDate = new Date(today); 
    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = toDate.toISOString().split('T')[0];

    let totalUpdated = 0; 
    let standingsUpdated = 0;
    let logs: string[] = [];
    const leaguesNeedingStandingsUpdate = new Set<string>();

    // 🟢 PHASE 1: EXACTLY ONE API CALL FOR ALL MATCHES GLOBALLY
    const res = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${fromStr}&dateTo=${toStr}`, { 
        headers: { 'X-Auth-Token': API_KEY } 
    });

    if (res.ok) {
        const data = await res.json();
        
        for (const m of data.matches || []) {
            const compCode = m.competition?.code;
            if (!TARGET_LEAGUES.includes(compCode)) continue;
            
            if (!['IN_PLAY', 'PAUSED', 'FINISHED', 'AWARDED'].includes(m.status)) continue; 
            
            const { data: dbMatch } = await supabase.from('matches').select('id, status, updated_at, home_score, away_score, espn_id').eq('api_id', m.id).single();
            if (!dbMatch) continue;

            const isFdFinished = ['FINISHED', 'AWARDED'].includes(m.status);
            const fdStatusMapped = isFdFinished ? 'FT' : (m.status === 'PAUSED' ? 'HT' : 'LIVE');
            const fdHomeScore = m.score.fullTime.home ?? 0;
            const fdAwayScore = m.score.fullTime.away ?? 0;
            let shouldUpdate = false;

            if (isFdFinished) {
                // If it wasn't FT in our DB yet, it JUST finished!
                if (dbMatch.status !== 'FT') {
                    shouldUpdate = true;
                    leaguesNeedingStandingsUpdate.add(compCode); 
                } else if (dbMatch.home_score !== fdHomeScore || dbMatch.away_score !== fdAwayScore) {
                    shouldUpdate = true; // Score correction
                    leaguesNeedingStandingsUpdate.add(compCode); 
                }
            } 
            else {
                const minutesSinceLastUpdate = (Date.now() - new Date(dbMatch.updated_at).getTime()) / 60000;
                if (dbMatch.status === 'SCHEDULED' || minutesSinceLastUpdate > 10 || !dbMatch.espn_id) {
                    if (dbMatch.home_score !== fdHomeScore || dbMatch.away_score !== fdAwayScore || dbMatch.status !== fdStatusMapped) {
                        shouldUpdate = true;
                    }
                }
            }

            if (shouldUpdate) {
                await supabase.from('matches').update({ home_score: fdHomeScore, away_score: fdAwayScore, status: fdStatusMapped, updated_at: new Date().toISOString() }).eq('api_id', m.id);
                totalUpdated++; logs.push(`Match Overwrite: ${m.id} (${compCode}) -> ${fdStatusMapped} ${fdHomeScore}-${fdAwayScore}`);
            }
        }
    } else {
        logs.push(`Global match fetch failed with status: ${res.status}`);
    }

    // 🟢 THE BYPASS: If forced, flag all target leagues for a standings update
    if (forceSync) {
        TARGET_LEAGUES.forEach(league => leaguesNeedingStandingsUpdate.add(league));
        logs.push("Admin forced a full standings sync.");
    }

    // 🟢 PHASE 2: STANDINGS SYNC (Max 6 calls, only if needed)
    for (const leagueId of Array.from(leaguesNeedingStandingsUpdate)) {
        if (leagueId === 'EC' || leagueId === 'WC') continue; 

        // 1.5 second pause between standings fetches to be extra gentle to the API
        await new Promise(resolve => setTimeout(resolve, 1500)); 

        const standRes = await fetch(`https://api.football-data.org/v4/competitions/${leagueId}/standings`, { headers: { 'X-Auth-Token': API_KEY } });
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
    }

    return NextResponse.json({ 
        success: true, 
        matchesUpdated: totalUpdated, 
        standingsUpdated, 
        leaguesTriggered: Array.from(leaguesNeedingStandingsUpdate),
        logs 
    });

  } catch (error: any) { 
      return NextResponse.json({ error: error.message }, { status: 500 }); 
  }
}