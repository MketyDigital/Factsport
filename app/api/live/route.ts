export const runtime = 'edge';
export const dynamic = 'force-dynamic'; 
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { fetchEspnLive, fetchEspnDetails, ESPN_LEAGUES } from '@/app/lib/espn';

async function runLiveUpdate(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('key') !== process.env.CRON_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  let logs: string[] = []; let updates = 0; 

  try {
      const now = Date.now();
      const lookForward = new Date(now + (2 * 60 * 60 * 1000)).toISOString();
      const lookBack = new Date(now - (24 * 60 * 60 * 1000)).toISOString(); 

      const { data: windowMatches } = await supabase.from('matches').select('*').not('espn_id', 'is', null).gt('match_date', lookBack).lt('match_date', lookForward);
      if (!windowMatches || windowMatches.length === 0) return NextResponse.json({ message: "No matches in window." });

      const activeMatches = windowMatches.filter(m => {
          // Explicitly Added PRE_MATCH to ensure pending games are picked up properly
          const isLiveOrUpcoming = ['LIVE', 'HT', 'IN_PLAY', 'SCHEDULED', 'TIMED', 'PRE', 'PRE_MATCH'].includes(m.status);
          
          const kickMs = Date.parse(m.match_date);
          const hoursSinceKick = (Date.now() - kickMs) / (1000 * 60 * 60);
          const isRecentlyFinished = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(m.status) && hoursSinceKick >= 0 && hoursSinceKick < 5;
          
          const isFinishedButBroken = ['FT', 'FINISHED'].includes(m.status) && (!m.match_events || m.match_events.length === 0);
          return isLiveOrUpcoming || isRecentlyFinished || isFinishedButBroken;
      });

      if (activeMatches.length === 0) return NextResponse.json({ message: "No active matches." });

      const activeLeagues = Array.from(new Set(activeMatches.map(m => m.league)));
      const terminalStatuses = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'];

      // Running sequentially prevents overloading memory on Cloudflare Edge Runtime
      for (const leagueName of activeLeagues) {
        const espnCode = ESPN_LEAGUES[leagueName as string];
        if (!espnCode) continue;

        const espnMatches = await fetchEspnLive(espnCode);
        const leagueDbMatches = activeMatches.filter(m => m.league === leagueName);

        for (const dbMatch of leagueDbMatches) {
             const espnGame = espnMatches.find((e: any) => String(e.espn_id) === dbMatch.espn_id);
             
             // Fetch details for all active matches ensuring updates even if missing from ESPN live scoreboard array
             const richData = await fetchEspnDetails(dbMatch.espn_id);
             
             let newStatus = dbMatch.status;
             const payload: any = { updated_at: new Date().toISOString() };

             if (espnGame) {
                 if (espnGame.status === 'in') newStatus = 'LIVE';
                 else if (espnGame.status === 'post') newStatus = 'FT'; 
                 else if (espnGame.status === 'pre') newStatus = 'PRE_MATCH';
                 else if (espnGame.clock === 'HT') newStatus = 'HT';
                 
                 payload.status = newStatus;
                 
                 const isTrackedByFD = !!dbMatch.api_id;
                 if (!terminalStatuses.includes(dbMatch.status) || !isTrackedByFD) {
                     payload.home_score = espnGame.home_score;
                     payload.away_score = espnGame.away_score;
                     payload.displayClock = espnGame.clock;
                 }
             } else if (richData) {
                 // Solid fallback: Update statuses strictly from the detailed endpoint data
                 if (richData.live_status === 'in') newStatus = 'LIVE';
                 else if (richData.live_status === 'post') newStatus = 'FT';
                 else if (richData.live_status === 'pre') newStatus = 'PRE_MATCH';
                 if (richData.clock === 'HT') newStatus = 'HT';
                 
                 payload.status = newStatus;
                 
                 const isTrackedByFD = !!dbMatch.api_id;
                 if (!terminalStatuses.includes(dbMatch.status) || !isTrackedByFD) {
                     payload.home_score = richData.live_home_score !== undefined ? richData.live_home_score : dbMatch.home_score;
                     payload.away_score = richData.live_away_score !== undefined ? richData.live_away_score : dbMatch.away_score;
                     payload.displayClock = richData.clock || dbMatch.displayClock;
                 }
             }

             if (richData) {
                 payload.match_events = richData.events; 
                 payload.stats = richData.stats; 
                 payload.lineups = richData.lineups;
                 
                 if (richData.venue) payload.venue = richData.venue;
                 if (richData.stage) payload.stage = richData.stage;
                 if (richData.match_group) payload.match_group = richData.match_group;
                 
                 if (richData.referees && richData.referees.length > 0) payload.referees = richData.referees;
                 if (richData.predictor) payload.predictor = richData.predictor;
             }

             await supabase.from('matches').update(payload).eq('id', dbMatch.id);
             updates++; 
             logs.push(`⚡ ESPN Synced: ${dbMatch.home_team}`);
        }
      }
      return NextResponse.json({ success: true, updates, logs });

  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function GET(request: Request) { return runLiveUpdate(request); }
export async function POST(request: Request) { return runLiveUpdate(request); }