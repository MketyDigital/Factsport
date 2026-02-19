export const runtime = 'edge';
export const dynamic = 'force-dynamic'; 
export const revalidate = 0;

import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';
import { ESPN_LEAGUES, fetchEspnLive, fetchEspnDetails, normalizeName } from '@/app/lib/espn';

async function runLiveUpdate() {
  const supabase = createClient();
  let logs: string[] = [];
  let updates = 0;

  try {
      const now = Date.now();
      const twentyFourHoursAgo = new Date(now - (24 * 60 * 60 * 1000)).toISOString();
      const twentyFourHoursFuture = new Date(now + (24 * 60 * 60 * 1000)).toISOString();

      // 🟢 THE SMART QUERY
      // 1. Active Games: LIVE, HT, SCHEDULED (Standard)
      // 2. 🧟 Zombie Games: LIVE/HT stuck from yesterday
      // 3. 🧹 Enrichment: FT matches from last 24h that have NO events (Fixes your issue!)
      const { data: dbMatches } = await supabase
        .from('matches')
        .select('*')
        .or('status.eq.LIVE,status.eq.HT,status.eq.IN_PLAY,status.eq.SCHEDULED,status.eq.TIMED,status.eq.PRE,and(status.eq.FT,match_events.is.null)')
        .gt('match_date', twentyFourHoursAgo) 
        .lt('match_date', twentyFourHoursFuture);

      if (!dbMatches || dbMatches.length === 0) {
          return NextResponse.json({ message: "No matches needing updates." });
      }

      const activeLeagues = Array.from(new Set(dbMatches.map(m => m.league)));

      for (const leagueName of activeLeagues) {
        const espnCode = ESPN_LEAGUES[leagueName as string];
        if (!espnCode) continue;

        // Fetch Live Scoreboard
        const espnMatches = await fetchEspnLive(espnCode);
        const leagueDbMatches = dbMatches.filter(m => m.league === leagueName);

        for (const dbMatch of leagueDbMatches) {
             const espnGame = espnMatches.find((e: any) => {
                 const dbHome = normalizeName(dbMatch.home_team);
                 const espnHome = normalizeName(e.home_team);
                 return dbHome.includes(espnHome) || espnHome.includes(dbHome);
             });

             if (espnGame) {
                 // Fetch Deep Details (Events, Stats, Lineups)
                 const richData = await fetchEspnDetails(espnGame.espn_id);
                 
                 let newStatus = dbMatch.status;
                 if (espnGame.status === 'in') newStatus = 'LIVE';
                 else if (espnGame.status === 'post') newStatus = 'FT'; 
                 else if (espnGame.clock === 'HT') newStatus = 'HT';
                 
                 // 🟢 PREPARE UPDATE
                 const payload: any = {
                     status: newStatus,
                     home_score: espnGame.home_score,
                     away_score: espnGame.away_score,
                     "displayClock": espnGame.clock,
                     updated_at: new Date().toISOString()
                 };

                 // Only update rich data if we found it
                 if (richData) {
                     payload.match_events = richData.events;
                     payload.stats = richData.stats;
                     payload.lineups = richData.lineups;
                 }

                 await supabase.from('matches').update(payload).eq('id', dbMatch.id);
                 
                 updates++;
                 // Log nicely so you see what happened
                 if (dbMatch.status === 'FT' && !dbMatch.match_events && richData) {
                     logs.push(`✨ Enriched: ${dbMatch.home_team} (Added Stats/Events)`);
                 } else {
                     logs.push(`✅ Synced: ${dbMatch.home_team} (${newStatus})`);
                 }
             }
        }
      }
      
      return NextResponse.json({ success: true, updates, logs });

  } catch (error: any) {
      console.error("Live Route Error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) { return runLiveUpdate(); }
export async function POST(request: Request) { return runLiveUpdate(); }