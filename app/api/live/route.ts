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
      const lookForward = new Date(now + (2 * 60 * 60 * 1000)).toISOString();
      const lookBack = new Date(now - (24 * 60 * 60 * 1000)).toISOString(); 

      const { data: windowMatches } = await supabase.from('matches').select('*').not('espn_id', 'is', null).gt('match_date', lookBack).lt('match_date', lookForward);
      if (!windowMatches || windowMatches.length === 0) return NextResponse.json({ message: "No matches in window." });

      const activeMatches = windowMatches.filter(m => {
          const isLiveOrUpcoming = ['LIVE', 'HT', 'IN_PLAY', 'SCHEDULED', 'TIMED', 'PRE'].includes(m.status);
          
          const kickMs = Date.parse(m.match_date);
          const hoursSinceKick = (Date.now() - kickMs) / (1000 * 60 * 60);
          const isRecentlyFinished = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(m.status) && hoursSinceKick < 5;
          
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
             const isFinishedButBroken = terminalStatuses.includes(dbMatch.status);
             
             if (espnGame || isFinishedButBroken || terminalStatuses.includes(dbMatch.status)) {
                 const updateTask = (async () => {
                     const richData = await fetchEspnDetails(dbMatch.espn_id);
                     let newStatus = dbMatch.status;
                     const payload: any = { updated_at: new Date().toISOString() };
                     
                     const isTrackedByFD = !!dbMatch.api_id;

                     if (richData) {
                         payload.match_events = richData.events || richData.match_events; 
                         payload.stats = richData.stats || {}; 
                         payload.lineups = richData.lineups;
                         
                         if (richData.venue) payload.venue = richData.venue;
                         if (richData.stage) payload.stage = richData.stage;
                         if (richData.match_group) payload.match_group = richData.match_group;
                         
                         if (richData.referees && richData.referees.length > 0) payload.referees = richData.referees;
                         if (richData.predictor) payload.predictor = richData.predictor;
                     }

                     // Fetch summary directly to guarantee accurate penalties and advanced statuses (AET, PEN, POSTPONED)
                     try {
                         const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${dbMatch.espn_id}&_=${Date.now()}`;
                         const res = await fetch(espnUrl, { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' } });
                         if (res.ok) {
                             const data = await res.json();
                             const header = data.header?.competitions?.[0];
                             if (header) {
                                 const homeComp = header.competitors?.find((c: any) => c.homeAway === 'home');
                                 const awayComp = header.competitors?.find((c: any) => c.homeAway === 'away');
                                 const currentStatus = header.status?.type?.state;
                                 const statusName = header.status?.type?.name; // e.g., STATUS_FINAL_PEN
                                 let currentClock = header.status?.type?.description === 'Halftime' ? 'HT' : (header.status?.displayClock || "0'");
                                 
                                 // Prevent clock rollback and fix late + stoppage time syncing
                                 if (data.commentary && data.commentary.length > 0 && currentClock !== 'HT' && currentStatus === 'in') {
                                     const latestTimeStr = data.commentary[0].time?.displayValue; 
                                     if (latestTimeStr && latestTimeStr.includes("'")) {
                                         const cleanClock = currentClock.replace(/:.*/, ''); 
                                         const clockNum = parseInt(cleanClock.replace(/\D/g, '')) || 0;
                                         const eventNum = parseInt(latestTimeStr.replace(/\D/g, '')) || 0;

                                         if (eventNum > clockNum) {
                                             currentClock = latestTimeStr; 
                                         } else if (eventNum === clockNum && latestTimeStr.includes('+') && !currentClock.includes('+')) {
                                             currentClock = latestTimeStr; 
                                         }
                                     }
                                 }

                                 // Extract Penalities
                                 if (homeComp?.shootoutScore !== undefined) {
                                     payload.home_penalty_score = parseInt(homeComp.shootoutScore);
                                     if (!payload.stats) payload.stats = {};
                                     payload.stats.home_penalties = parseInt(homeComp.shootoutScore);
                                 }
                                 if (awayComp?.shootoutScore !== undefined) {
                                     payload.away_penalty_score = parseInt(awayComp.shootoutScore);
                                     if (!payload.stats) payload.stats = {};
                                     payload.stats.away_penalties = parseInt(awayComp.shootoutScore);
                                 }

                                 // Extract Half Time Scores
                                 const homeHT = homeComp?.linescores?.[0]?.value;
                                 const awayHT = awayComp?.linescores?.[0]?.value;
                                 if (homeHT !== undefined) {
                                     if (!payload.stats) payload.stats = {};
                                     payload.stats.home_ht = parseInt(homeHT);
                                 }
                                 if (awayHT !== undefined) {
                                     if (!payload.stats) payload.stats = {};
                                     payload.stats.away_ht = parseInt(awayHT);
                                 }

                                 // Extract Aggregate
                                 const aggSummary = header.series?.summary || data.header?.series?.summary || null;
                                 if (aggSummary) {
                                     if (!payload.stats) payload.stats = {};
                                     payload.stats.aggregate = aggSummary;
                                 }

                                 // Map advanced statuses
                                 if (statusName === 'STATUS_FINAL_PEN') {
                                     newStatus = 'PEN';
                                 } else if (statusName === 'STATUS_FINAL_AET') {
                                     newStatus = 'AET';
                                 } else if (statusName === 'STATUS_POSTPONED') {
                                     newStatus = 'POSTPONED';
                                 } else if (statusName === 'STATUS_CANCELED') {
                                     newStatus = 'CANCELLED';
                                 } else if (statusName === 'STATUS_ABANDONED') {
                                     newStatus = 'ABD';
                                 } else if (currentClock === 'HT') {
                                     newStatus = 'HT';
                                 } else if (currentStatus === 'in') {
                                     newStatus = 'LIVE';
                                 } else if (currentStatus === 'post') {
                                     newStatus = 'FT';
                                 } else if (currentStatus === 'pre') {
                                     newStatus = 'PRE_MATCH';
                                 }

                                 payload.status = newStatus;

                                 if (!terminalStatuses.includes(dbMatch.status) || !isTrackedByFD) {
                                     payload.home_score = parseInt(homeComp?.score) || 0;
                                     payload.away_score = parseInt(awayComp?.score) || 0;
                                     payload.displayClock = currentClock;
                                 }
                             }
                         }
                     } catch (err) {
                         // Fallback to espnGame summary if direct fetch fails
                         if (espnGame) {
                             if (espnGame.status === 'in') newStatus = 'LIVE';
                             else if (espnGame.status === 'post') newStatus = 'FT'; 
                             else if (espnGame.status === 'pre') newStatus = 'PRE_MATCH';
                             else if (espnGame.clock === 'HT') newStatus = 'HT';
                             
                             payload.status = newStatus;
                             
                             if (!terminalStatuses.includes(dbMatch.status) || !isTrackedByFD) {
                                 payload.home_score = espnGame.home_score;
                                 payload.away_score = espnGame.away_score;
                                 payload.displayClock = espnGame.clock;
                             }
                         }
                     }

                     // Fallbacks from richData if not captured
                     if (payload.home_score === undefined && richData && richData.stats?.home_score !== undefined) {
                         payload.home_score = richData.stats.home_score;
                         payload.away_score = richData.stats.away_score;
                     }
                     if (payload.home_penalty_score === undefined && payload.stats?.home_penalties !== undefined) {
                         payload.home_penalty_score = payload.stats.home_penalties;
                     }
                     if (payload.away_penalty_score === undefined && payload.stats?.away_penalties !== undefined) {
                         payload.away_penalty_score = payload.stats.away_penalties;
                     }

                     await supabase.from('matches').update(payload).eq('id', dbMatch.id);
                     
                     const statusChangedToFT = (newStatus === 'FT' || newStatus === 'AET' || newStatus === 'PEN') && !terminalStatuses.includes(dbMatch.status);
                     const scoresChanged = payload.home_score !== dbMatch.home_score || payload.away_score !== dbMatch.away_score || payload.home_penalty_score !== dbMatch.home_penalty_score || payload.away_penalty_score !== dbMatch.away_penalty_score;
                     
                     const lineupsAnnounced = payload.lineups && payload.lineups.home?.length >= 11 && (!dbMatch.lineups?.home || dbMatch.lineups.home.length < 11);

                     if (statusChangedToFT || scoresChanged || lineupsAnnounced) {
                         const internalOrigin = new URL(request.url).origin;
                         const targetRecord = { ...dbMatch, ...payload };
                         
                         fetch(`${internalOrigin}/api/social`, {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CRON_KEY}` },
                             body: JSON.stringify({ record: targetRecord, old_record: dbMatch })
                         }).catch(e => console.error("Social Broadcast Intercept Failed:", e.message));
                     }

                     return true;
                 })();
                 syncTasks.push(updateTask); updates++; logs.push(`⚡ ESPN Synced: ${dbMatch.home_team}`);
             }
        }
      }
      await Promise.all(syncTasks);
      return NextResponse.json({ success: true, updates, logs });

  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function GET(request: Request) { return runLiveUpdate(request); }
export async function POST(request: Request) { return runLiveUpdate(request); }