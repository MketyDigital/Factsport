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
  const bumpTasks: Promise<any>[] = []; // For clearing the traffic jam

  try {
      const now = Date.now();
      const lookForward = new Date(now + (2 * 60 * 60 * 1000)).toISOString();
      const lookBackLive = new Date(now - (24 * 60 * 60 * 1000)).toISOString(); // 24 hours for live
      const lookBackPatch = new Date(now - (5 * 24 * 60 * 60 * 1000)).toISOString(); // 5 days for historical

      // 🏎️ 1. THE VIP LANE: Get Live & Upcoming Matches (Priority #1)
      const { data: liveDbMatches } = await supabase
        .from('matches')
        .select('*')
        .not('espn_id', 'is', null)
        .gt('match_date', lookBackLive) 
        .lt('match_date', lookForward)
        .in('status', ['LIVE', 'HT', 'IN_PLAY', 'SCHEDULED', 'TIMED', 'PRE']);

      // 🚜 2. THE MAINTENANCE LANE: Get Old Finished Matches
      const { data: patchDbMatches } = await supabase
        .from('matches')
        .select('*')
        .not('espn_id', 'is', null)
        .gt('match_date', lookBackPatch) 
        .lt('match_date', lookForward)
        .in('status', ['FT', 'FINISHED'])
        .order('updated_at', { ascending: true }) 
        .limit(20); 

      // Clear the traffic jam: Find which old matches actually need fixing
      const validPatchMatches: any[] = [];
      (patchDbMatches || []).forEach(m => {
          if (!m.match_events || m.match_events.length === 0) {
              validPatchMatches.push(m); // Needs fixing!
          } else {
              // 🔥 FIXED: Wrapped in an async function so TypeScript knows it is a Promise!
              bumpTasks.push(
                  (async () => await supabase.from('matches').update({ updated_at: new Date().toISOString() }).eq('id', m.id))()
              );
          }
      });

      // Combine Live matches with up to 5 empty historical matches
      const activeMatches = [...(liveDbMatches || []), ...validPatchMatches.slice(0, 5)];

      if (!activeMatches || activeMatches.length === 0) {
          await Promise.all(bumpTasks); // Clear traffic even if no active matches
          return NextResponse.json({ message: "No active matches. Traffic jam cleared. Sleeping.", timestamp: now });
      }

      const activeLeagues = Array.from(new Set(activeMatches.map(m => m.league)));

      for (const leagueName of activeLeagues) {
        const espnCode = ESPN_LEAGUES[leagueName as string];
        if (!espnCode) continue;

        const espnMatches = await fetchEspnLive(espnCode);
        const leagueDbMatches = activeMatches.filter(m => m.league === leagueName);

        for (const dbMatch of leagueDbMatches) {
             const espnGame = espnMatches.find((e: any) => String(e.espn_id) === dbMatch.espn_id);
             const isFinishedNeedingPatch = ['FT', 'FINISHED'].includes(dbMatch.status);

             if (espnGame || isFinishedNeedingPatch) {
                 const updateTask = (async () => {
                     const richData = await fetchEspnDetails(dbMatch.espn_id);
                     
                     const payload: any = {
                         updated_at: new Date().toISOString()
                     };

                     if (espnGame) {
                         let newStatus = dbMatch.status;
                         if (espnGame.status === 'in') newStatus = 'LIVE';
                         else if (espnGame.status === 'post') newStatus = 'FT'; 
                         else if (espnGame.clock === 'HT') newStatus = 'HT';
                         
                         payload.status = newStatus;
                         payload.home_score = espnGame.home_score;
                         payload.away_score = espnGame.away_score;
                         payload.displayClock = espnGame.clock;
                     }

                     if (richData) {
                         payload.match_events = richData.events;
                         payload.stats = richData.stats;
                         payload.lineups = richData.lineups;
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
      
      // Execute all updates and traffic-clearing bumps at once
      await Promise.all([...syncTasks, ...bumpTasks]);
      return NextResponse.json({ success: true, updates, logs, timestamp: now });

  } catch (error: any) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) { return runLiveUpdate(request); }
export async function POST(request: Request) { return runLiveUpdate(request); }