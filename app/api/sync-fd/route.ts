// app/api/sync-fd/route.ts

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const TERMINAL_STATUSES = new Set(["FT", "FINISHED", "AET", "PEN", "AWARDED", "ABD"]);

const DEFAULT_TARGET_LEAGUES = [
  "PL",
  "PD",
  "BL1",
  "SA",
  "FL1",
  "CL",
  "EL",
  "UECL",
  "EC",
  "WC",
  "PPL",
  "DED",
  "BSA"
];

const normalizeFdStatusMap: Record<string, string> = {
  SCHEDULED: "SCHEDULED",
  TIMED: "SCHEDULED",
  IN_PLAY: "LIVE",
  PAUSED: "HT",
  FINISHED: "FT",
  AWARDED: "FT",
  CERTIFIED: "FT",
  CANCELLED: "CANC",
  POSTPONED: "POST",
  SUSPENDED: "SUSP"
};

const normalizeFdStatus = (status?: string) => {
  if (!status) return null;
  const s = String(status).toUpperCase();
  return normalizeFdStatusMap[s] || null;
};

const hasNoEspnId = (match: any) => {
  return !match?.espn_id || String(match.espn_id).trim() === "";
};

const hasFdPenaltyShootout = (fdMatch: any) => {
  return Boolean(
    fdMatch?.score?.penalties &&
    (
      fdMatch.score.penalties.home !== null ||
      fdMatch.score.penalties.home !== undefined ||
      fdMatch.score.penalties.away !== null ||
      fdMatch.score.penalties.away !== undefined
    )
  );
};

const hasDbPenaltyShootout = (dbMatch: any) => {
  return Boolean(
    dbMatch?.stats?.home_penalties !== null ||
    dbMatch?.stats?.home_penalties !== undefined ||
    dbMatch?.stats?.away_penalties !== null ||
    dbMatch?.stats?.away_penalties !== undefined ||
    String(dbMatch?.status || "").toUpperCase() === "PEN"
  );
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
    .from("standings")
    .select("league_code");

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
    logs.push("Background clock audit: syncing tables.");
  }

  const targetStandingsLeagues = Array.from(leaguesNeedingStandingsUpdate);

  if (targetStandingsLeagues.length === 0) {
    return 0;
  }

  const standingsFetches = targetStandingsLeagues.map((leagueId) =>
    fetch(`https://api.football-data.org/v4/competitions/${leagueId}/standings`, {
      headers: { "X-Auth-Token": API_KEY }
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
    const table = standData?.standings?.find((s: any) => s.type === "TOTAL")?.table || [];

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
    .from("standings")
    .delete()
    .in("league_code", successfulLeagues);

  if (deleteError) {
    logs.push(`Standings delete error: ${deleteError.message}`);
    return 0;
  }

  const { error: insertError } = await supabase
    .from("standings")
    .insert(allStandingsToInsert);

  if (insertError) {
    logs.push(`Standings insert error: ${insertError.message}`);
    return 0;
  }

  return allStandingsToInsert.length;
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const authHeader = request.headers.get("Authorization") || "";
  const key =
    url.searchParams.get("key") ||
    (authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : authHeader);

  if (key !== process.env.CRON_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const forceSync = url.searchParams.get("force") === "true";
  const FD_CAN_OVERRIDE_ESPN = process.env.FD_CAN_OVERRIDE_ESPN === "true";

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
        reason: "Missing Football Data API key"
      },
      { status: 200 }
    );
  }

  const targetLeagues = (
    process.env.FD_SYNC_LEAGUES ||
    DEFAULT_TARGET_LEAGUES.join(",")
  )
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);

  if (targetLeagues.length === 0) {
    return NextResponse.json(
      {
        success: true,
        skipped: true,
        reason: "No target leagues configured"
      },
      { status: 200 }
    );
  }

  const logs: string[] = [];
  let matchesUpdatedCount = 0;
  let matchUpdateFailures = 0;
  let skippedWithEspnId = 0;
  let espnCorrections = 0;

  const now = new Date();

  const fdLookBackDays = Number(process.env.FD_SYNC_LOOKBACK_DAYS || 1);
  const fdLookAheadDays = Number(process.env.FD_SYNC_LOOKAHEAD_DAYS || 1);

  const fromDate = new Date(now);
  fromDate.setUTCDate(now.getUTCDate() - fdLookBackDays);

  const toDate = new Date(now);
  toDate.setUTCDate(now.getUTCDate() + fdLookAheadDays);

  const fromStr = fromDate.toISOString().split("T")[0];
  const toStr = toDate.toISOString().split("T")[0];

  const fdRes = await fetch(
    `https://api.football-data.org/v4/matches?dateFrom=${fromStr}&dateTo=${toStr}`,
    {
      headers: { "X-Auth-Token": API_KEY }
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

  if (fdMatches.length === 0) {
    const standingsUpdated = await syncStandings(supabase, targetLeagues, forceSync, logs);

    return NextResponse.json({
      success: true,
      matchesVerified: 0,
      skippedNotFinished: 0,
      skippedWithEspnId,
      standingsUpdated,
      logs
    });
  }

  const apiIds = Array.from(
    new Set(fdMatches.map((m: any) => String(m.id)))
  );

  const { data: dbMatches, error: dbError } = await supabase
    .from("matches")
    .select("*")
    .in("api_id", apiIds);

  if (dbError) {
    throw dbError;
  }

  const dbMap = new Map<string, any>(
    (dbMatches || []).map((m: any) => [String(m.api_id), m])
  );

  const matchUpdates: Promise<any>[] = [];
  const socialDispatches: Promise<void>[] = [];

  for (const fdMatch of fdMatches) {
    const dbMatch = dbMap.get(String(fdMatch.id));
    if (!dbMatch) continue;

    const fdStatus = normalizeFdStatus(fdMatch.status);
    if (!fdStatus) continue;

    const isFdTerminal = TERMINAL_STATUSES.has(fdStatus);
    const oldStatus = String(dbMatch.status || "").toUpperCase();
    const isDbTerminal = TERMINAL_STATUSES.has(oldStatus);

    let fdRawHomeScore =
      fdMatch.score?.fullTime?.home ??
      fdMatch.score?.regularTime?.home ??
      fdMatch.score?.halfTime?.home;

    let fdRawAwayScore =
      fdMatch.score?.fullTime?.away ??
      fdMatch.score?.regularTime?.away ??
      fdMatch.score?.halfTime?.away;

    if (fdStatus !== "SCHEDULED" && fdStatus !== "POST" && fdStatus !== "CANC") {
      fdRawHomeScore = fdRawHomeScore ?? 0;
      fdRawAwayScore = fdRawAwayScore ?? 0;
    }

    const fdHomeScore = Number(fdRawHomeScore);
    const fdAwayScore = Number(fdRawAwayScore);

    const fdScoresAvailable =
      fdRawHomeScore !== null &&
      fdRawHomeScore !== undefined &&
      fdRawAwayScore !== null &&
      fdRawAwayScore !== undefined;

    const scoresChanged =
      fdScoresAvailable &&
      (
        Number(dbMatch.home_score ?? 0) !== fdHomeScore ||
        Number(dbMatch.away_score ?? 0) !== fdAwayScore
      );

    const statusChanged = oldStatus !== fdStatus;
    const hasEspnId = !hasNoEspnId(dbMatch);

    let needsUpdate = false;
    let isEspnCorrection = false;

    if (hasEspnId) {
      skippedWithEspnId++;

      const fdHasPenaltyShootout = hasFdPenaltyShootout(fdMatch);
      const dbHasPenaltyShootout = hasDbPenaltyShootout(dbMatch);

      if (
        FD_CAN_OVERRIDE_ESPN &&
        isFdTerminal &&
        isDbTerminal &&
        scoresChanged &&
        !fdHasPenaltyShootout &&
        !dbHasPenaltyShootout
      ) {
        needsUpdate = true;
        isEspnCorrection = true;
        espnCorrections++;

        logs.push(
          `🚨 ESPN FT correction allowed for ${dbMatch.id}: ESPN(${dbMatch.home_score}-${dbMatch.away_score}) vs FD(${fdHomeScore}-${fdAwayScore})`
        );
      } else {
        logs.push(
          `⏭️ Skipped ESPN-mapped match ${dbMatch.id}; ESPN is source of truth.`
        );
        continue;
      }
    } else {
      if (statusChanged || scoresChanged) {
        needsUpdate = true;
      }
    }

    if (!needsUpdate) continue;

    const nowIso = new Date().toISOString();

    const payload: any = {
      status: fdStatus,
      updated_at: nowIso
    };

    if (fdRawHomeScore !== undefined && fdRawHomeScore !== null) {
      payload.home_score = fdHomeScore;
    }

    if (fdRawAwayScore !== undefined && fdRawAwayScore !== null) {
      payload.away_score = fdAwayScore;
    }

    const updatePromise = (async () => {
      const result = await supabase
        .from("matches")
        .update(payload)
        .eq("id", dbMatch.id);

      if (result?.error) {
        matchUpdateFailures++;
        logs.push(`FD update failed ${dbMatch.id}: ${result.error.message}`);
      } else {
        matchesUpdatedCount++;
        logs.push(
          `FD update: ${fdMatch.id} ${dbMatch.home_team} vs ${dbMatch.away_team} -> ${fdHomeScore}-${fdAwayScore} (${fdStatus})`
        );
      }

      return result;
    })();

    matchUpdates.push(updatePromise);

    const targetRecord = {
      ...dbMatch,
      ...payload
    };

    if (statusChanged || scoresChanged) {
      const internalOrigin = url.origin;

      socialDispatches.push(
        fetch(`${internalOrigin}/api/social`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.CRON_KEY}`
          },
          body: JSON.stringify({
            record: targetRecord,
            old_record: dbMatch
          })
        }).then(() => {}).catch((e: any) => {
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
    matchesUpdated: matchesUpdatedCount,
    matchUpdateFailures,
    skippedWithEspnId,
    espnCorrections,
    standingsUpdated,
    logs
  });
}

export async function POST(request: Request) {
  return GET(request);
}
