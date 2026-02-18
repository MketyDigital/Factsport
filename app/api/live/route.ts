export const runtime = 'edge';
export const dynamic = 'force-dynamic'; // 🛑 Critical for live updates
export const revalidate = 0;

import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';
import { ESPN_LEAGUES, fetchEspnLive, fetchEspnDetails, normalizeName } from '@/app/lib/espn';

export async function GET(request: Request) {
  const supabase = createClient();
  let logs: string[] = [];
  let updates = 0;

  try {
      // 1. Get Active Matches (Look 3 hours back/forward)
      // We look for SCHEDULED matches too, so we can flip them to LIVE
      const now = Date.now();
      const timeWindow = 3 * 60 * 60 * 1000;
      
      const { data: dbMatches } = await supabase
        .from('matches')
        .select('*')
        .or('status.eq.LIVE,status.eq.HT,status.eq.SCHEDULED,status.eq.TIMED') 
        .gt('match_date', new Date(now - timeWindow).toISOString()) 
        .lt('match_date', new Date(now + timeWindow).toISOString());

      if (!dbMatches || dbMatches.length === 0) {
          return NextResponse.json({ message: "No active matches found." });
      }

      // 2. Filter only leagues we actually have in DB to save API calls
      const activeLeagues = Array.from(new Set(dbMatches.map(m => m.league)));

      for (const leagueName of activeLeagues) {
        // Skip leagues we don't have a mapping for
        const espnCode = ESPN_LEAGUES[leagueName as string];
        if (!espnCode) continue;

        // Fetch Live Scoreboard from ESPN
        const espnMatches = await fetchEspnLive(espnCode);

        for (const espnGame of espnMatches) {
          // 3. Find the matching game in our DB
          const matchInDb = dbMatches.find(db => {
            if (db.league !== leagueName) return false;
            
            // Strict Time Match (4 Hours buffer)
            const diff = Math.abs(new Date(db.match_date).getTime() - espnGame.startTime);
            if (diff > (4 * 60 * 60 * 1000)) return false; 
            
            // Name Match (Normalization handles "Man City" vs "Manchester City")
            const dbHome = normalizeName(db.home_team);
            const espnHome = normalizeName(espnGame.home_team);
            return dbHome.includes(espnHome) || espnHome.includes(dbHome);
          });

          if (matchInDb) {
            // 🟢 MATCH FOUND: FETCH RICH DATA
            // This gets the Commentary events, Lineups, and Stats
            const richData = await fetchEspnDetails(espnGame.espn_id);
            
            let updatePayload: any = {
               home_score: espnGame.home_score,
               away_score: espnGame.away_score,
               "displayClock": espnGame.clock,
               updated_at: new Date().toISOString()
            };

            // 🟢 STATUS TRANSITION LOGIC
            // 'in' = Live, 'post' = Full Time, 'pre' = Scheduled
            if (espnGame.status === 'in') {
                updatePayload.status = 'LIVE';
            } else if (espnGame.status === 'post') {
                updatePayload.status = 'FT';
            } else if (espnGame.clock === 'HT') {
                updatePayload.status = 'HT';
            } 
            // If it's still 'pre', we leave it alone (or keep it SCHEDULED)

            // 🟢 SAVE RICH DATA
            if (richData) {
                updatePayload.match_events = richData.events; // This includes your new Text Commentary
                updatePayload.stats = richData.stats;
                updatePayload.lineups = richData.lineups;
            }

            // Perform Update
            await supabase.from('matches').update(updatePayload).eq('id', matchInDb.id);
            
            updates++;
            logs.push(`✅ Sync: ${matchInDb.home_team} vs ${matchInDb.away_team} [${updatePayload.status}]`);
          }
        }
      }

      return NextResponse.json({ success: true, updates, logs });

  } catch (error: any) {
      console.error("Live Route Error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}