export const runtime = 'edge';
export const dynamic = 'force-dynamic'; 
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { fetchEspnLive, fetchEspnDetails, ESPN_LEAGUES } from '@/app/lib/espn';

async function runLiveUpdate(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('key') !== process.env.CRON_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let logs: string[] = [];
  let updates = 0;
  const syncTasks: Promise<any>[] = []; 

  try {
      const now = Date.now();
      // Look back 24 hours, look forward 2 hours
      const lookForward = new Date(now + (2 * 60 * 60 * 1000)).toISOString();
      const lookBack = new Date(now - (24 * 60 * 60 * 1000)).toISOString(); 

      // 1. Fetch EVERYTHING in that time window
      const { data: windowMatches } = await supabase
        .from('matches')
        .select('*')
        .not('espn_id', 'is', null)
        .gt('match_date', lookBack) 
        .lt('match_date', lookForward);

      if (!windowMatches || windowMatches.length === 0) {
          return NextResponse.json({ message: "No matches in the 24h window. Sleeping.", timestamp: now });
      }

      // 2. THE VIP FILTER: Only process Live/Upcoming OR Finished matches that are missing data
      const activeMatches = windowMatches.filter(m => {
          const isLiveOrUpcoming = ['LIVE', 'HT', 'IN_PLAY', 'SCHEDULED', 'TIMED', 'PRE'].includes(m.status);
          const isFinishedButBroken = ['FT', 'FINISHED'].includes(m.status) && (!m.match_events || m.match_events.length === 0);
          
          return isLiveOrUpcoming || isFinishedButBroken;
      });

      if (activeMatches.length === 0) {
          return NextResponse.json({ message: "All finished matches are complete, no live matches right now. Sleeping.", timestamp: now });
      }

      const activeLeagues = Array.from(new Set(activeMatches.map(m => m.league)));

      for (const leagueName of activeLeagues) {
        const espnCode = ESPN_LEAGUES[leagueName as string];
        if (!espnCode) continue;

        const espnMatches = await fetchEspnLive(espnCode);
        const leagueDbMatches = activeMatches.filter(m => m.league === leagueName);

        for (const dbMatch of leagueDbMatches) {
             const espnGame = espnMatches.find((e: any) => String(e.espn_id) === dbMatch.espn_id);
             const isFinishedButBroken = ['FT', 'FINISHED'].includes(dbMatch.status);
             
             // Process if it's on today's live scoreboard OR if it's an old finished game needing a patch
             if (espnGame || isFinishedButBroken) {
                 const updateTask = (async () => {
                     const richData = await fetchEspnDetails(dbMatch.espn_id);
                     
                     let newStatus = dbMatch.status;
                     const payload: any = { updated_at: new Date().toISOString() };

                     // Update the live score/clock if ESPN has it actively playing
                     if (espnGame) {
                         if (espnGame.status === 'in') newStatus = 'LIVE';
                         else if (espnGame.status === 'post') newStatus = 'FT'; 
                         else if (espnGame.clock === 'HT') newStatus = 'HT';
                         
                         payload.status = newStatus;
                         payload.home_score = espnGame.home_score;
                         payload.away_score = espnGame.away_score;
                         payload.displayClock = espnGame.clock;
                     }

                     // 🟢 INJECT THE PRISTINE DATA (Now includes Venue, Referees, and Predictor!)
                     if (richData) {
                         payload.match_events = richData.events;
                         payload.stats = richData.stats;
                         payload.lineups = richData.lineups;
                         
                         // Overwrite empty DB data with rich ESPN data
                         if (richData.venue) payload.venue = richData.venue;
                         if (richData.referees && richData.referees.length > 0) payload.referees = richData.referees;
                         if (richData.predictor) payload.predictor = richData.predictor;
                     }

                     const { error } = await supabase.from('matches').update(payload).eq('id', dbMatch.id);
                     if (error) throw error;
                     return true;
                 })();

                 syncTasks.push(updateTask);
                 updates++;
                 logs.push(`⚡ Synced: ${dbMatch.home_team} vs ${dbMatch.away_team}`);
             }
        }
      }
      
      await Promise.all(syncTasks);
      return NextResponse.json({ success: true, updates, logs, timestamp: now });

  } catch (error: any) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) { return runLiveUpdate(request); }
export async function POST(request: Request) { return runLiveUpdate(request); }