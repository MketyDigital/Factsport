export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';
import { ESPN_LEAGUES, fetchEspnLive, fetchEspnDetails, normalizeName } from '@/app/lib/espn';

export async function GET(request: Request) {
  const supabase = createClient();
  let logs: string[] = [];
  let updates = 0;

  // 1. Get Active Matches (Lookback 3 hours, Lookahead 3 hours)
  const now = Date.now();
  const timeWindow = 3 * 60 * 60 * 1000;
  
  const { data: dbMatches } = await supabase
    .from('matches')
    .select('*')
    .or('status.eq.LIVE,status.eq.HT,status.eq.SCHEDULED,status.eq.TIMED') 
    .gt('match_date', new Date(now - timeWindow).toISOString()) 
    .lt('match_date', new Date(now + timeWindow).toISOString());

  if (!dbMatches || dbMatches.length === 0) return NextResponse.json({ message: "No active matches." });

  const activeLeagues = [...new Set(dbMatches.map(m => m.league))];

  for (const leagueName of activeLeagues) {
    const espnCode = ESPN_LEAGUES[leagueName];
    if (!espnCode) continue;

    // A. Get Basic Scoreboard
    const espnMatches = await fetchEspnLive(espnCode);

    for (const espnGame of espnMatches) {
      const matchInDb = dbMatches.find(db => {
        if (db.league !== leagueName) return false;
        const diff = Math.abs(new Date(db.match_date).getTime() - espnGame.startTime);
        if (diff > (4 * 60 * 60 * 1000)) return false; 
        const dbHome = normalizeName(db.home_team);
        const espnHome = normalizeName(espnGame.home_team);
        return dbHome.includes(espnHome) || espnHome.includes(dbHome);
      });

      if (matchInDb) {
        // B. Fetch Rich Details (Lineups, Stats, Events)
        const richData = await fetchEspnDetails(espnGame.espn_id);
        
        // Prepare Update Object
        let updatePayload: any = {
           home_score: espnGame.home_score,
           away_score: espnGame.away_score,
           "displayClock": espnGame.clock,
           updated_at: new Date().toISOString()
        };

        // Status Logic
        if (espnGame.status === 'in') updatePayload.status = 'LIVE';
        else if (espnGame.status === 'post') updatePayload.status = 'FT';
        else if (espnGame.clock === 'HT') updatePayload.status = 'HT';
        else updatePayload.status = matchInDb.status; // Keep existing if unsure

        // Add Rich Data if available
        if (richData) {
            updatePayload.match_events = richData.events;
            updatePayload.stats = richData.stats;
            updatePayload.lineups = richData.lineups;
        }

        // C. Update Database
        await supabase.from('matches').update(updatePayload).eq('id', matchInDb.id);
        
        updates++;
        logs.push(`✅ Full Sync: ${matchInDb.home_team} vs ${matchInDb.away_team}`);
      }
    }
  }

  return NextResponse.json({ success: true, updates, logs });
}