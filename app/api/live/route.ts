export const runtime = 'edge';
export const dynamic = 'force-dynamic'; 
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { fetchEspnLive, fetchEspnDetails, ESPN_LEAGUES } from '@/app/lib/espn';

// Option 2 KV Cache Implementation: In-memory Edge Cache.
// This allows the route to know if it already processed a score change 
// even if the database fails to save the update.
const kvCache = new Map<string, string>();

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

      for (const leagueName of activeLeagues) {
        const espnCode = ESPN_LEAGUES[leagueName as string];
        if (!espnCode) continue;

        const espnMatches = await fetchEspnLive(espnCode);
        const leagueDbMatches = activeMatches.filter(m => m.league === leagueName);

        for (const dbMatch of leagueDbMatches) {
             const espnGame = espnMatches.find((e: any) => String(e.espn_id) === dbMatch.espn_id);
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

             // DATABASE INDEPENDENCE LOGIC: Compare ESPN State vs DB/KV Cache and fire social directly
             const dbStateStr = `${dbMatch.status}_${dbMatch.home_score}_${dbMatch.away_score}_${dbMatch.match_events?.length || 0}`;
             const espnStateStr = `${newStatus}_${payload.home_score}_${payload.away_score}_${payload.match_events?.length || 0}`;
             
             const cacheKey = String(dbMatch.id);
             const cachedState = kvCache.get(cacheKey);

             if (espnStateStr !== dbStateStr && espnStateStr !== cachedState) {
                 // Instantly cache the new state to prevent duplicates if DB update fails below
                 kvCache.set(cacheKey, espnStateStr); 

                 const oldState = { ...dbMatch };
                 const newState = { ...dbMatch, ...payload, espn_id: dbMatch.espn_id }; 
                 
                 // Fire directly to social route, completely bypassing the DB webhooks
                 const origin = request.headers.get('origin') || new URL(request.url).origin;
                 fetch(`${origin}/api/social`, {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CRON_KEY}` },
                     body: JSON.stringify({ record: newState, old_record: oldState })
                 }).catch(err => console.error("Social direct trigger failed:", err));
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