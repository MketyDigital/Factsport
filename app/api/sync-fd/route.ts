// app/api/sync-fd/route.ts

// @ts-nocheck
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get('key') !== process.env.CRON_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const forceSync = searchParams.get('force') === 'true';

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const API_KEY = process.env.FOOTBALL_DATA_KEY || process.env.FOOTBALL_DATA_API_KEY;

  if (!API_KEY) {
    return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });
  }

  const DEFAULT_TARGET_LEAGUES = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'CL', 'EL', 'UECL', 'EC', 'WC', 'PPL', 'DED', 'BSA'];
  const TARGET_LEAGUES = (process.env.FD_SYNC_LEAGUES || DEFAULT_TARGET_LEAGUES.join(',')).split(',').map((l) => l.trim()).filter(Boolean);

  try {
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - 3);

    const toDate = new Date(today);
    toDate.setDate(today.getDate() + 1);

    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = toDate.toISOString().split('T')[0];

    let matchesFinalized = 0;
    let standingsUpdated = 0;
    const logs: string[] = [];
    const leaguesNeedingStandingsUpdate = new Set<string>();

    const res = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${fromStr}&dateTo=${toStr}`, {
      headers: { 'X-Auth-Token': API_KEY }
    });

    if (res.ok) {
      const data = await res.json();
      const fdMatches = data.matches || [];

      if (fdMatches.length > 0) {
        const apiIds = fdMatches
          .map((m: any) => m.id)
          .filter((id: number) => TARGET_LEAGUES.includes(String(m?.competition?.code)));

        const { data: dbMatches, error: dbError } = await supabase
          .from('matches')
          .select('*')
          .in('api_id', apiIds);

        if (dbError) throw dbError;

        const dbMap = new Map((dbMatches || []).map((m) => [m.api_id, m]));
        const matchUpdates: Promise<any>[] = [];

        for (const m of fdMatches) {
          const compCode = m.competition?.code;

          if (!TARGET_LEAGUES.includes(compCode)) continue;

          let fdStatusMapped = 'SCHEDULED';

          if (['FINISHED', 'AWARDED'].includes(m.status)) {
            fdStatusMapped = 'FT';
          } else if (m.status === 'POSTPONED' || m.status === 'CANCELLED' || m.status === 'SUSPENDED') {
            fdStatusMapped = 'POSTPONED';
          } else {
            fdStatusMapped = m.status;
          }

          const dbMatch = dbMap.get(m.id);
          if (!dbMatch) continue;

          const fdHomeScore = m.score?.fullTime?.home ?? 0;
          const fdAwayScore = m.score?.fullTime?.away ?? 0;

          if (fdStatusMapped === 'FT') {
            leaguesNeedingStandingsUpdate.add(compCode);

            if (
              dbMatch.status !== 'FT' ||
              Number(dbMatch.home_score) !== Number(fdHomeScore) ||
              Number(dbMatch.away_score) !== Number(fdAwayScore)
            ) {
              matchUpdates.push(
                supabase.from('matches').update({
                  home_score: fdHomeScore,
                  away_score: fdAwayScore,
                  status: 'FT',
                  updated_at: new Date().toISOString()
                }).eq('api_id', m.id)
              );

              matchesFinalized++;
              logs.push(`FT Sync: ${m.id} (${compCode}) -> ${fdHomeScore}-${fdAwayScore}`);

              const targetRecord = {
                ...dbMatch,
                home_score: fdHomeScore,
                away_score: fdAwayScore,
                status: 'FT',
                updated_at: new Date().toISOString()
              };

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
              }).catch((e) => console.error('Late FT social dispatch failed:', e.message));
            }
          }
        }

        if (matchUpdates.length > 0) {
          await Promise.all(matchUpdates);
        }
      }
    } else {
      logs.push(`FD matches fetch skipped: ${res.status}`);
    }

    const { data: existingStandings } = await supabase.from('standings').select('league_code');
    const presentLeagues = new Set((existingStandings || []).map((s: any) => s.league_code));

    TARGET_LEAGUES.forEach((league) => {
      if (!presentLeagues.has(league)) {
        leaguesNeedingStandingsUpdate.add(league);
        logs.push(`Self-healing standings trigger: ${league}`);
      }
    });

    const currentMinutes = today.getUTCMinutes();
    const isHalfHourInterval = (currentMinutes >= 0 && currentMinutes < 5) || (currentMinutes >= 30 && currentMinutes < 35);

    if (isHalfHourInterval || forceSync) {
      TARGET_LEAGUES.forEach((league) => leaguesNeedingStandingsUpdate.add(league));
      logs.push('Background clock audit: syncing tables.');
    }

    const targetStandingsLeagues = Array.from(leaguesNeedingStandingsUpdate);

    if (targetStandingsLeagues.length > 0) {
      const standingsFetches = targetStandingsLeagues.map((leagueId) =>
        fetch(`https://api.football-data.org/v4/competitions/${leagueId}/standings`, {
          headers: { 'X-Auth-Token': API_KEY }
        }).then((r) => r.ok ? r.json() : null).catch(() => null)
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

      if (allStandingsToInsert.length > 0 && successfulLeagues.length > 0) {
        await supabase.from('standings').delete().in('league_code', successfulLeagues);

        const { error: stdErr } = await supabase.from('standings').insert(allStandingsToInsert);

        if (!stdErr) {
          standingsUpdated += allStandingsToInsert.length;
        } else {
          logs.push(`Standings insert error: ${stdErr.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      matchesVerified: matchesFinalized,
      standingsUpdated,
      leaguesTriggered: targetStandingsLeagues,
      logs
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}