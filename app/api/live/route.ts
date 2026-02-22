export const runtime = 'edge';
export const dynamic = 'force-dynamic'; 
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// 🟢 CHANGED: Using the official supabase-js client to bypass RLS
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { fetchEspnLive, fetchEspnDetails, ESPN_LEAGUES } from '@/app/lib/espn';

async function runLiveUpdate(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('key') !== process.env.CRON_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 🟢 CHANGED: Initialized with the Service Role (Master) Key
  const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let logs: string[] = [];
  let updates = 0;
  const syncTasks: Promise<any>[] = []; 

  try {
      const now = Date.now();
      const lookForward = new Date(now + (2 * 60 * 60 * 1000)).toISOString();
      const lookBack = new Date(now - (24 * 60 * 60 * 1000)).toISOString(); 

      const { data: dbMatches } = await supabase
        .from('matches')
        .select('*')
        .not('espn_id', 'is', null)
        .gt('match_date', lookBack) 
        .lt('match_date', lookForward);

      const activeMatches = dbMatches?.filter(m => {
          const isStartingSoonOrPlaying = ['LIVE', 'HT', 'IN_PLAY', 'SCHEDULED', 'TIMED', 'PRE'].includes(m.status);
          const needsFinalData = ['FT', 'FINISHED'].includes(m.status) && (!m.match_events || m.match_events.length === 0);
          return isStartingSoonOrPlaying || needsFinalData;
      });

      if (!activeMatches || activeMatches.length === 0) {
          return NextResponse.json({ message: "No active matches. Sleeping.", timestamp: now });
      }

      const activeLeagues = Array.from(new Set(activeMatches.map(m => m.league)));

      for (const leagueName of activeLeagues) {
        const espnCode = ESPN_LEAGUES[leagueName as string];
        if (!espnCode) continue;

        const espnMatches = await fetchEspnLive(espnCode);
        const leagueDbMatches = activeMatches.filter(m => m.league === leagueName);

        for (const dbMatch of leagueDbMatches) {
             const espnGame = espnMatches.find((e: any) => String(e.espn_id) === dbMatch.espn_id);

             if (espnGame) {
                 const updateTask = (async () => {
                     const richData = await fetchEspnDetails(espnGame.espn_id);
                     
                     let newStatus = dbMatch.status;
                     if (espnGame.status === 'in') newStatus = 'LIVE';
                     else if (espnGame.status === 'post') newStatus = 'FT'; 
                     else if (espnGame.clock === 'HT') newStatus = 'HT';
                     
                     const payload: any = {
                         status: newStatus,
                         home_score: espnGame.home_score,
                         away_score: espnGame.away_score,
                         displayClock: espnGame.clock,
                         updated_at: new Date().toISOString()
                     };

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
                 logs.push(`⚡ Live Synced: ${dbMatch.home_team} vs ${dbMatch.away_team}`);
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