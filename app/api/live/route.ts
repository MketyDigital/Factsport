export const runtime = 'edge';
export const dynamic = 'force-dynamic'; 
export const revalidate = 0;

import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';
import { ESPN_LEAGUES, fetchEspnLive, fetchEspnDetails, normalizeName } from '@/app/lib/espn';

// 🟢 SHARED LOGIC
async function runLiveUpdate() {
  const supabase = createClient();
  let logs: string[] = [];
  let updates = 0;

  try {
      const now = Date.now();
      
      // 🟢 WIDENED WINDOW
      // Look back 24 Hours (Catch stuck games from yesterday)
      // Look forward 24 Hours (Catch ALL of today's games, even if 12 hours away)
      const twentyFourHoursAgo = new Date(now - (24 * 60 * 60 * 1000)).toISOString();
      const twentyFourHoursFuture = new Date(now + (24 * 60 * 60 * 1000)).toISOString();

      // 1. FETCH MATCHES
      const { data: dbMatches } = await supabase
        .from('matches')
        .select('*')
        .or('status.eq.LIVE,status.eq.HT,status.eq.IN_PLAY,status.eq.SCHEDULED,status.eq.TIMED,status.eq.PRE')
        .gt('match_date', twentyFourHoursAgo) 
        .lt('match_date', twentyFourHoursFuture); // ✅ Checks next 24 hours now

      if (!dbMatches || dbMatches.length === 0) {
          return NextResponse.json({ message: "No matches found in the next/past 24h." });
      }

      const activeLeagues = Array.from(new Set(dbMatches.map(m => m.league)));

      for (const leagueName of activeLeagues) {
        const espnCode = ESPN_LEAGUES[leagueName as string];
        if (!espnCode) continue;

        // Fetch Live Scoreboard
        const espnMatches = await fetchEspnLive(espnCode);
        const leagueDbMatches = dbMatches.filter(m => m.league === leagueName);

        for (const dbMatch of leagueDbMatches) {
             // Find matching ESPN game
             const espnGame = espnMatches.find((e: any) => {
                 const dbHome = normalizeName(dbMatch.home_team);
                 const espnHome = normalizeName(e.home_team);
                 return dbHome.includes(espnHome) || espnHome.includes(dbHome);
             });

             if (espnGame) {
                 const richData = await fetchEspnDetails(espnGame.espn_id);
                 
                 let newStatus = dbMatch.status;
                 // ESPN Mapping
                 if (espnGame.status === 'in') newStatus = 'LIVE';
                 else if (espnGame.status === 'post') newStatus = 'FT'; 
                 else if (espnGame.clock === 'HT') newStatus = 'HT';
                 
                 const payload: any = {
                     status: newStatus,
                     home_score: espnGame.home_score,
                     away_score: espnGame.away_score,
                     "displayClock": espnGame.clock,
                     updated_at: new Date().toISOString()
                 };

                 if (richData) {
                     payload.match_events = richData.events;
                     payload.stats = richData.stats;
                     payload.lineups = richData.lineups;
                 }

                 await supabase.from('matches').update(payload).eq('id', dbMatch.id);
                 updates++;
                 logs.push(`✅ Synced: ${dbMatch.home_team} (${newStatus})`);
             }
        }
      }
      
      // If no updates, list what we checked so you know it's working
      if (updates === 0) {
          logs.push(`checked ${dbMatches.length} matches, but ESPN had no status changes.`);
      }

      return NextResponse.json({ success: true, updates, logs });

  } catch (error: any) {
      console.error("Live Route Error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 🟢 EXPORT BOTH
export async function GET(request: Request) {
    return runLiveUpdate();
}

export async function POST(request: Request) {
    return runLiveUpdate();
}