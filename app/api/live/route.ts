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
      // Look back 24h for missed games, forward 24h for today's games
      const twentyFourHoursAgo = new Date(now - (24 * 60 * 60 * 1000)).toISOString();
      const twentyFourHoursFuture = new Date(now + (24 * 60 * 60 * 1000)).toISOString();

      // 🟢 1. FETCH EVERYTHING IN WINDOW (Simplified Query)
      // We grab ALL matches from the last 24h. We will decide which ones need help in JS.
      const { data: dbMatches } = await supabase
        .from('matches')
        .select('*')
        .gt('match_date', twentyFourHoursAgo) 
        .lt('match_date', twentyFourHoursFuture);

      if (!dbMatches || dbMatches.length === 0) {
          return NextResponse.json({ message: "No matches found in window." });
      }

      // 🟢 2. SMART FILTERING IN JS
      // We keep matches that are:
      // A) Currently Active (LIVE, HT, etc.)
      // B) Scheduled (PRE, TIMED)
      // C) FINISHED but MISSING DATA (The fix for your problem)
      const targetMatches = dbMatches.filter(m => {
          const isActive = ['LIVE', 'HT', 'IN_PLAY', 'SCHEDULED', 'TIMED', 'PRE'].includes(m.status);
          const isFinished = ['FT', 'FINISHED', 'ABD', 'POST'].includes(m.status);
          
          // Check if events are missing (Null OR Empty Array)
          const isMissingData = !m.match_events || (Array.isArray(m.match_events) && m.match_events.length === 0);

          return isActive || (isFinished && isMissingData);
      });

      if (targetMatches.length === 0) {
          return NextResponse.json({ message: "All matches are up to date." });
      }

      logs.push(`Found ${targetMatches.length} matches needing updates...`);

      const activeLeagues = Array.from(new Set(targetMatches.map(m => m.league)));

      for (const leagueName of activeLeagues) {
        const espnCode = ESPN_LEAGUES[leagueName as string];
        if (!espnCode) continue;

        // Fetch Live Scoreboard
        const espnMatches = await fetchEspnLive(espnCode);
        const leagueDbMatches = targetMatches.filter(m => m.league === leagueName);

        for (const dbMatch of leagueDbMatches) {
             const espnGame = espnMatches.find((e: any) => {
                 const dbHome = normalizeName(dbMatch.home_team);
                 const espnHome = normalizeName(e.home_team);
                 return dbHome.includes(espnHome) || espnHome.includes(dbHome);
             });

             if (espnGame) {
                 // Always fetch details if we are targeting this match
                 const richData = await fetchEspnDetails(espnGame.espn_id);
                 
                 let newStatus = dbMatch.status;
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
                 if (['FT', 'FINISHED'].includes(newStatus)) {
                     logs.push(`✨ Enriched: ${dbMatch.home_team}`);
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