// app/api/sync-fd/route.ts

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const TERMINAL_STATUSES = new Set(['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD']);

const DEFAULT_TARGET_LEAGUES = [
  'PL',
  'PD',
  'BL1',
  'SA',
  'FL1',
  'CL',
  'EL',
  'UECL',
  'EC',
  'WC',
  'PPL',
  'DED',
  'BSA'
];

const normalizeFdStatus = (status?: string) => {
  if (!status) return null;

  const s = String(status).toUpperCase();

  if (s === 'FINISHED' || s === 'AWARDED') {
    return 'FT';
  }

  return null;
};

const hasNoEspnId = (match: any) => {
  return !match?.espn_id || String(match.espn_id).trim() === '';
};

async function syncStandings(
  supabase: any,
  targetLeagues: string[],
  forceSync: boolean,
  logs: string[]
) {
  const API_KEY = process.env.FOOTBALL_DATA_KEY || process.env.FOOTBALL_DATA_API_KEY;

  if (!API_KEY) return 0;

  const { data: existingStandings, error: standingsFetchError } = await supabase
    .from('standings')
    .select('league_code');

  if (standingsFetchError) {
    logs.push(`Standings fetch error: ${standingsFetchError.message}`);
    return 0;
  }

  const presentLeagues = new Set(
    (existingStandings || []).map((s: any) => s.league_code)
  );

  const leaguesNeedingStandingsUpdate = new Set<string>();

  targetLeagues.forEach((league) => {
    if (!presentLeagues.has(league)) {
      leaguesNeedingStandingsUpdate.add(league);
      logs.push(`Self-healing standings trigger: ${league}`);
    }
  });

  const currentMinutes = new Date().getUTCMinutes();
  const isHalfHourInterval =
    (currentMinutes >= 0 && currentMinutes < 5) ||
    (currentMinutes >= 30 && currentMinutes < 35);

  if (isHalfHourInterval || forceSync) {
    targetLeagues.forEach((league) => leaguesNeedingStandingsUpdate.add(league));
    logs.push('Background clock audit: syncing tables.');
  }

  const targetStandingsLeagues = Array.from(leaguesNeedingStandingsUpdate);

  if (targetStandingsLeagues.length === 0) {
    return 0;
  }

  const standingsFetches = targetStandingsLeagues.map((leagueId) =>
    fetch(`https://api.football-data.org/v4/competitions/${leagueId}/standings`, {
      headers: { 'X-Auth-Token': API_KEY }
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
  );

  const standingsResults = await Promise.all(standingsFetches);

  let allStandingsToInsert: any[] = [];
  const successfulLeagues: string[] = [];

  standingsResults.forEach((standData, index) => {
    if (!standData) return;

    const leagueId = targetStandingsLeagues[index];
    const table = standData?.standings?.find((s: any) => s.type === 'TOTAL')?.table || [];

    if (table.length > 0) {
      const mappedTable = table.map((entry: any) => ({
        league_code: leagueId,
        position: entry.position,
        team_id: entry.team.id,
        team_name: entry.team.name,
        team_short_name: entry.team.shortName || entry.team.name,
        team_crest: entry.team.crest,
        played_games: entry.playedGames,
        won: entry.won,
        draw: entry.draw,
        lost: entry.lost,
        goal_difference: entry.goalDifference,
        points: entry.points,
        updated_at: new Date().toISOString()
      }));

      allStandingsToInsert = allStandingsToInsert.concat(mappedTable);
      successfulLeagues.push(leagueId);
      logs.push(`Standings prepared: ${leagueId}`);
    }
  });

  if (allStandingsToInsert.length === 0 || successfulLeagues.length === 0) {
    return 0;
  }

  const { error: deleteError } = await supabase
    .from('standings')
    .delete()
    .in('league_code', successfulLeagues);

  if (deleteError) {
    logs.push(`Standings delete error: ${deleteError.message}`);
    return 0;
  }

  const { error: insertError } = await supabase
    .from('standings')
    .insert(allStandingsToInsert);

  if (insertError) {
    logs.push(`Standings insert error: ${insertError.message}`);
    return 0;
  }

  return allStandingsToInsert.length;
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const authHeader = request.headers.get('Authorization') || '';
  const key =
    url.searchParams.get('key') ||
    (authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : authHeader);

  if (key !== process.env.CRON_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const forceSync = url.searchParams.get('force') === 'true';

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const API_KEY = process.env.FOOTBALL_DATA_KEY || process.env.FOOTBALL_DATA_API_KEY;

  if (!API_KEY) {
    return NextResponse.json(
      {
        success: true,
        skipped: true,
        reason: 'Missing Football Data API key'
      },
      { status: 200 }
    );
  }

  const targetLeagues = (
    process.env.FD_SYNC_LEAGUES ||
    DEFAULT_TARGET_LEAGUES.join(',')
  )
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean);

  if (targetLeagues.length === 0) {
    return NextResponse.json(
      {
        success: true,
        skipped: true,
        reason: 'No target leagues configured'
      },
      { status: 200 }
    );
  }

  const logs: string[] = [];
  let matchesFinalized = 0;
  let matchUpdateFailures = 0;
  let skippedWithEspnId = 0;

  /**
   * FT-only window.
   * This route does NOT fetch live status.
   * It only asks FD for matches that may have finished.
   */
  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setUTCDate(now.getUTCDate() - 1);

  const toDate = new Date(now);
  toDate.setUTCDate(now.getUTCDate() + 1);

  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];

  const fdRes = await fetch(
    `https://api.football-data.org/v4/matches?dateFrom=${fromStr}&dateTo=${toStr}`,
    {
      headers: { 'X-Auth-Token': API_KEY }
    }
  );

  if (!fdRes.ok) {
    return NextResponse.json(
      {
        success: true,
        skipped: true,
        reason: `FD matches fetch skipped: ${fdRes.status}`
      },
      { status: 200 }
    );
  }

  const fdData = await fdRes.json();
  const fdMatches = (fdData.matches || []).filter((m: any) =>
    targetLeagues.includes(String(m?.competition?.code))
  );

  const finishedFdMatches = fdMatches.filter((m: any) => normalizeFdStatus(m.status));

  if (finishedFdMatches.length === 0) {
    const standingsUpdated = await syncStandings(supabase, targetLeagues, forceSync, logs);

    return NextResponse.json({
      success: true,
      matchesVerified: 0,
      skippedNotFinished: fdMatches.length,
      skippedWithEspnId,
      standingsUpdated,
      logs
    });
  }

  const apiIds = Array.from(
    new Set(finishedFdMatches.map((m: any) => String(m.id)))
  );

  const { data: dbMatches, error: dbError } = await supabase
    .from('matches')
    .select('*')
    .in('api_id', apiIds);

  if (dbError) {
    throw dbError;
  }

  const dbMap = new Map<string, any>(
    (dbMatches || []).map((m: any) => [String(m.api_id), m])
  );

  const matchUpdates: Promise<any>[] = [];
  const socialDispatches: Promise<void>[] = [];

  for (const fdMatch of finishedFdMatches) {
    const dbMatch = dbMap.get(String(fdMatch.id));

    if (!dbMatch) continue;

    /**
     * Critical rule:
     * sync-fd must never touch ESPN-owned matches.
     * ESPN matches are owned by Cloudflare Worker /api/live-sync or Next /api/live.
     */
    if (!hasNoEspnId(dbMatch)) {
      skippedWithEspnId++;
      continue;
    }

    const fdStatus = normalizeFdStatus(fdMatch.status);

    if (!fdStatus) continue;

    const fdHomeScore = Number(fdMatch.score?.fullTime?.home ?? 0);
    const fdAwayScore = Number(fdMatch.score?.fullTime?.away ?? 0);

    const oldStatus = String(dbMatch.status || '').toUpperCase();
    const statusChangedToFT =
      !TERMINAL_STATUSES.has(oldStatus) && TERMINAL_STATUSES.has(fdStatus);

    const scoresChanged =
      Number(dbMatch.home_score) !== fdHomeScore ||
      Number(dbMatch.away_score) !== fdAwayScore;

    if (!statusChangedToFT && !scoresChanged) {
      continue;
    }

    const nowIso = new Date().toISOString();

    const payload = {
      status: fdStatus,
      home_score: fdHomeScore,
      away_score: fdAwayScore,
      updated_at: nowIso
    };

    const updatePromise = supabase
      .from('matches')
      .update(payload)
      .eq('id', dbMatch.id)
      .then((result: any) => {
        if (result?.error) {
          matchUpdateFailures++;
          logs.push(`FD FT update failed ${dbMatch.id}: ${result.error.message}`);
        } else {
          matchesFinalized++;
          logs.push(
            `FD FT fallback: ${fdMatch.id} ${dbMatch.home_team} vs ${dbMatch.away_team} -> ${fdHomeScore}-${fdAwayScore}`
          );
        }

        return result;
      });

    matchUpdates.push(updatePromise);

    const targetRecord = {
      ...dbMatch,
      ...payload
    };

    if (statusChangedToFT || scoresChanged) {
      const internalOrigin = url.origin;

      socialDispatches.push(
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
        }).catch((e: any) => {
          logs.push(`Social dispatch failed for ${dbMatch.id}: ${e.message}`);
        })
      );
    }
  }

  await Promise.all(matchUpdates);
  await Promise.all(socialDispatches);

  const standingsUpdated = await syncStandings(supabase, targetLeagues, forceSync, logs);

  return NextResponse.json({
    success: true,
    matchesVerified: matchesFinalized,
    matchUpdateFailures,
    skippedWithEspnId,
    skippedNotFinished: fdMatches.length - finishedFdMatches.length,
    standingsUpdated,
    logs
  });
}

export async function POST(request: Request) {
  return GET(request);
}