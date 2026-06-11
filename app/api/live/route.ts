// app/api/live/route.ts

// @ts-nocheck
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { fetchEspnDetails } from '@/app/lib/espn';

const TERMINAL_STATUSES = new Set(['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD']);
const LIVE_STATUSES = new Set(['LIVE', 'HT', 'IN_PLAY', '1H', '2H', 'ET', 'P', 'PENALTIES']);
const PRE_STATUSES = new Set(['SCHEDULED', 'PRE', 'NS', 'UPCOMING', 'TBD']);

async function runLiveUpdate(request: Request) {
  const url = new URL(request.url);

  if (url.searchParams.get('key') !== process.env.CRON_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const logs: string[] = [];
  let updates = 0;

  try {
    const now = Date.now();
    const lookBack = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const lookForward = new Date(now + 48 * 60 * 60 * 1000).toISOString();

    const { data: windowMatches, error: fetchError } = await supabase
      .from('matches')
      .select('*')
      .not('espn_id', 'is', null)
      .gt('match_date', lookBack)
      .lt('match_date', lookForward);

    if (fetchError) throw fetchError;

    if (!windowMatches || windowMatches.length === 0) {
      return NextResponse.json({ message: 'No matches in window.' });
    }

    const activeMatches = windowMatches.filter((m) => {
      const status = String(m.status || '').toUpperCase();
      const kickMs = new Date(m.match_date).getTime();
      const minutesToKick = Number.isFinite(kickMs) ? (kickMs - Date.now()) / 60000 : 999999;

      if (TERMINAL_STATUSES.has(status)) return false;
      if (LIVE_STATUSES.has(status)) return true;
      if ((PRE_STATUSES.has(status) || status === '') && minutesToKick <= 150 && minutesToKick > -240) return true;
      if (!m.match_events || m.match_events.length === 0) return true;
      if (!m.lineups || m.lineups.home?.length === 0) return true;

      return false;
    });

    if (activeMatches.length === 0) {
      return NextResponse.json({ message: 'No active matches.' });
    }

    const pool: Promise<any>[] = [];
    const concurrency = Number(process.env.LIVE_SYNC_CONCURRENCY || 3);

    const updateOne = async (dbMatch: any) => {
      try {
        const richData = await fetchEspnDetails(dbMatch.espn_id);
        if (!richData) return;

        const payload: any = {
          updated_at: new Date().toISOString(),
          last_live_sync_at: new Date().toISOString(),
          status: richData.status,
          home_score: richData.home_score,
          away_score: richData.away_score,
          displayClock: richData.displayClock,
          match_events: richData.match_events || richData.events,
          events: richData.events || richData.match_events,
          stats: richData.stats,
          lineups: richData.lineups,
          venue: richData.venue,
          referees: richData.referees,
          predictor: richData.predictor,
          stage: richData.stage,
          match_group: richData.match_group,
          match_type: richData.match_type,
          round: richData.round,
          group_summary: richData.group_summary,
          knockout: richData.knockout,
          final: richData.final
        };

        if (richData.home_logo) payload.home_logo = richData.home_logo;
        if (richData.away_logo) payload.away_logo = richData.away_logo;

        await supabase.from('matches').update(payload).eq('id', dbMatch.id);

        const targetRecord = { ...dbMatch, ...payload };

        const statusChangedToFT = TERMINAL_STATUSES.has(String(targetRecord.status).toUpperCase()) && !TERMINAL_STATUSES.has(String(dbMatch.status).toUpperCase());
        const scoresChanged = Number(targetRecord.home_score) !== Number(dbMatch.home_score) || Number(targetRecord.away_score) !== Number(dbMatch.away_score);
        const lineupsAnnounced = String(dbMatch.status).toUpperCase() === 'SCHEDULED' && LIVE_STATUSES.has(String(targetRecord.status).toUpperCase());

        if (statusChangedToFT || scoresChanged || lineupsAnnounced) {
          const internalOrigin = new URL(request.url).origin;

          fetch(`${internalOrigin}/api/social`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.CRON_KEY}`
            },
            body: JSON.stringify({
              record: targetRecord,
              old_record: dbMatch
            })
          }).catch((e) => console.error('Live social dispatch failed:', e.message));
        }

        updates++;
        logs.push(`⚡ ESPN Synced: ${dbMatch.home_team} vs ${dbMatch.away_team}`);
      } catch (e: any) {
        logs.push(`⚠️ Failed ${dbMatch.espn_id}: ${e.message}`);
      }
    };

    for (const dbMatch of activeMatches) {
      pool.push(updateOne(dbMatch));

      if (pool.length >= concurrency) {
        await Promise.all(pool.splice(0, pool.length));
      }
    }

    await Promise.all(pool);

    return NextResponse.json({ success: true, updates, logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return runLiveUpdate(request);
}

export async function POST(request: Request) {
  return runLiveUpdate(request);
}