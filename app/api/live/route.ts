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
  let logs: string[] = []; let updates = 0; const syncTasks: Promise<any>[] = []; 

  try {
      const now = Date.now();
      // Expanded window to 24 hours to ensure upcoming/yesterday matches are caught regardless of timezone
      const lookForward = new Date(now + (24 * 60 * 60 * 1000)).toISOString();
      const lookBack = new Date(now - (24 * 60 * 60 * 1000)).toISOString(); 

      const { data: windowMatches } = await supabase.from('matches').select('*').not('espn_id', 'is', null).gt('match_date', lookBack).lt('match_date', lookForward);
      if (!windowMatches || windowMatches.length === 0) return NextResponse.json({ message: "No matches in window." });

      const terminalStatuses = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'];

      const activeMatches = windowMatches.filter(m => {
          // Standardized statuses
          const isLiveOrUpcoming = ['LIVE', 'HT', 'IN_PLAY', 'SCHEDULED', 'TIMED', 'PRE', 'PRE_MATCH'].includes(m.status);
          
          const kickMs = Date.parse(m.match_date);
          const hoursSinceKick = (Date.now() - kickMs) / (1000 * 60 * 60);
          const isRecentlyFinished = terminalStatuses.includes(m.status) && hoursSinceKick < 5;
          
          const isFinishedButBroken = terminalStatuses.includes(m.status) && (!m.match_events || m.match_events.length === 0);
          return isLiveOrUpcoming || isRecentlyFinished || isFinishedButBroken;
      });

      if (activeMatches.length === 0) return NextResponse.json({ message: "No active matches." });

      const activeLeagues = Array.from(new Set(activeMatches.map(m => m.league)));

      for (const leagueName of activeLeagues) {
        const espnCode = ESPN_LEAGUES[leagueName as string];
        if (!espnCode) continue;

        const espnMatches = await fetchEspnLive(espnCode);
        const leagueDbMatches = activeMatches.filter(m => m.league === leagueName);

        for (const dbMatch of leagueDbMatches) {
             const espnGame = espnMatches.find((e: any) => String(e.espn_id) === dbMatch.espn_id);
             
             const isLiveInDb = ['LIVE', 'HT', 'IN_PLAY'].includes(dbMatch.status);
             const kickMs = Date.parse(dbMatch.match_date);
             const hoursToKick = (kickMs - Date.now()) / (1000 * 60 * 60);
             
             // Check if match is starting soon or recently started (even if missing from ESPN live scoreboard)
             const isSoon = hoursToKick >= -5 && hoursToKick < 2; 
             const isRecentlyFinished = terminalStatuses.includes(dbMatch.status);
             const isFinishedButBroken = terminalStatuses.includes(dbMatch.status) && (!dbMatch.match_events || dbMatch.match_events.length === 0);
             
             // Proceed if it's on the scoreboard, OR if we know it should be live/soon/broken
             if (espnGame || isLiveInDb || isSoon || isRecentlyFinished || isFinishedButBroken) {
                 const updateTask = (async () => {
                     const richData = await fetchEspnDetails(dbMatch.espn_id);
                     let newStatus = dbMatch.status;
                     const payload: any = { updated_at: new Date().toISOString() };

                     // Prioritize scoreboard status if available, fallback to richData status direct from match summary
                     let currentEspnStatus = espnGame?.status || richData?.status;
                     let currentEspnClock = espnGame?.clock || richData?.clock;
                     let currentHomeScore = espnGame ? espnGame.home_score : richData?.home_score;
                     let currentAwayScore = espnGame ? espnGame.away_score : richData?.away_score;

                     if (currentEspnStatus) {
                         if (currentEspnStatus === 'in') newStatus = 'LIVE';
                         else if (currentEspnStatus === 'post') newStatus = 'FT'; 
                         else if (currentEspnStatus === 'pre') newStatus = 'SCHEDULED';
                         else if (currentEspnStatus === 'postponed') newStatus = 'POSTPONED';
                         else if (currentEspnStatus === 'canceled') newStatus = 'CANCELLED';
                         
                         if (currentEspnClock === 'HT' || currentEspnClock === 'Halftime') newStatus = 'HT';
                         
                         payload.status = newStatus;
                         
                         const isTrackedByFD = !!dbMatch.api_id;
                         // Update scores if not FT, OR if it's strictly an ESPN match (not tracked by FD)
                         if (!terminalStatuses.includes(dbMatch.status) || !isTrackedByFD) {
                             if (currentHomeScore !== undefined) payload.home_score = currentHomeScore;
                             if (currentAwayScore !== undefined) payload.away_score = currentAwayScore;
                             if (currentEspnClock !== undefined) payload.displayClock = currentEspnClock;
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
                     
                     return true;
                 })();
                 syncTasks.push(updateTask); updates++; logs.push(`⚡ ESPN Synced: ${dbMatch.home_team} (${dbMatch.status})`);
             }
        }
      }
      await Promise.all(syncTasks);
      return NextResponse.json({ success: true, updates, logs });

  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function GET(request: Request) { return runLiveUpdate(request); }
export async function POST(request: Request) { return runLiveUpdate(request); }