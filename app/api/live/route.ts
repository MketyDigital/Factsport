// @ts-nocheck
export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { fetchEspnDetails } from "@/app/lib/espn";

const TERMINAL_STATUSES = new Set(["FT", "FINISHED", "POST", "ENDED", "FULL_TIME", "AET", "PEN", "AWARDED", "ABD"]);
const LIVE_STATUSES = new Set(["LIVE", "HT", "HALFTIME", "IN_PLAY", "IN", "1H", "2H", "ET", "EXTRA_TIME", "P", "PENALTIES"]);
const PRE_STATUSES = new Set(["SCHEDULED", "PRE", "TIMED", "NS", "UPCOMING", "TBD", ""]);

const stableStringify = (value: any) => {
  try {
    return JSON.stringify(value || null);
  } catch {
    return "";
  }
};

const hasRichLineups = (lineups: any) => {
  return Boolean(
    lineups &&
    (
      (Array.isArray(lineups.home) && lineups.home.length > 0) ||
      (Array.isArray(lineups.away) && lineups.away.length > 0)
    )
  );
};

const hasRichStats = (stats: any) => {
  return Boolean(
    stats &&
    (
      Object.keys(stats.home || {}).length > 0 ||
      Object.keys(stats.away || {}).length > 0 ||
      stats.home_penalties !== undefined ||
      stats.away_penalties !== undefined ||
      stats.home_ht !== undefined ||
      stats.away_ht !== undefined
    )
  );
};

const normalizeStatus = (status: any) => {
  const raw = String(status || "").toUpperCase();

  const map: Record<string, string> = {
    IN_PLAY: "LIVE",
    IN: "LIVE",
    PAUSED: "HT",
    HALFTIME: "HT",
    HALF_TIME: "HT",
    "HALF-TIME": "HT",
    FINISHED: "FT",
    FULL_TIME: "FT",
    "FULL TIME": "FT",
    POST: "FT",
    AWARDED: "FT"
  };

  return map[raw] || raw;
};

const shouldUpdate = (dbMatch: any, richData: any) => {
  const dbStatus = normalizeStatus(dbMatch.status);
  const nextStatus = normalizeStatus(richData.status);

  // CRITICAL FIX: If DB is scheduled and ESPN is FT, update it!
  const statusChanged = dbStatus !== nextStatus;
  const scoresChanged =
    Number(dbMatch.home_score ?? 0) !== Number(richData.home_score ?? 0) ||
    Number(dbMatch.away_score ?? 0) !== Number(richData.away_score ?? 0);

  const dbEvents = dbMatch.match_events || dbMatch.events || [];
  const nextEvents = richData.match_events || richData.events || [];
  const eventsChanged = stableStringify(dbEvents) !== stableStringify(nextEvents);

  const lineupsChanged = stableStringify(dbMatch.lineups) !== stableStringify(richData.lineups);
  const statsChanged = stableStringify(dbMatch.stats) !== stableStringify(richData.stats);

  if (LIVE_STATUSES.has(nextStatus)) return true;
  if (TERMINAL_STATUSES.has(nextStatus)) {
    // If it's finished on ESPN but DB is not, force update.
    if (!TERMINAL_STATUSES.has(dbStatus)) return true;
    return statusChanged || scoresChanged || eventsChanged;
  }
  if (PRE_STATUSES.has(nextStatus)) return statusChanged || scoresChanged || lineupsChanged || statsChanged;

  return lineupsChanged || statsChanged;
};

async function runLiveUpdate(request: Request) {
  const url = new URL(request.url);
  const espnIdParam = url.searchParams.get("espn_id");
  const cronKey = url.searchParams.get("key");

  if (cronKey !== process.env.CRON_KEY && !espnIdParam) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const logs: string[] = [];
  let updates = 0;
  let skipped = 0;
  let failures = 0;

  try {
    let activeMatches = [];

    if (espnIdParam) {
      const { data: dbMatch, error: singleFetchError } = await supabase
        .from("matches")
        .select("*")
        .eq("espn_id", espnIdParam)
        .limit(1)
        .maybeSingle();

      if (singleFetchError || !dbMatch) {
         return NextResponse.json({ success: false, message: "Match not mapped or not found in database." });
      }

      const lastSync = dbMatch.last_live_sync_at ? new Date(dbMatch.last_live_sync_at).getTime() : 0;
      if (Date.now() - lastSync < 10000) {
         return NextResponse.json({ success: true, message: "Throttled: match recently synced.", match: dbMatch });
      }

      activeMatches = [dbMatch];
    } else {
      const lookBackDays = Number(process.env.LIVE_SYNC_LOOKBACK_DAYS || 1);
      const lookForwardDays = Number(process.env.LIVE_SYNC_LOOKAHEAD_DAYS || 2);

      const lookBack = new Date(Date.now() - lookBackDays * 24 * 60 * 60 * 1000).toISOString();
      const lookForward = new Date(Date.now() + lookForwardDays * 24 * 60 * 60 * 1000).toISOString();

      const { data: windowMatches, error: fetchError } = await supabase
        .from("matches")
        .select("*")
        .not("espn_id", "is", null)
        .gte("match_date", lookBack)
        .lte("match_date", lookForward)
        .order("match_date", { ascending: true });

      if (fetchError) throw fetchError;

      if (!windowMatches || windowMatches.length === 0) {
        return NextResponse.json({
          success: true,
          updates: 0,
          skipped: 0,
          failures: 0,
          message: "No ESPN-mapped matches in sync window."
        });
      }

      activeMatches = windowMatches.filter((m: any) => {
        if (!String(m.espn_id || "").trim()) return false;

        const kickMs = new Date(m.match_date).getTime();
        const minutesSinceKick = Number.isFinite(kickMs) ? (Date.now() - kickMs) / 60000 : 0;

        return minutesSinceKick < 12 * 60;
      });
    }

    const concurrency = Math.max(1, Math.min(5, Number(process.env.LIVE_SYNC_CONCURRENCY || 3)));

    const updateOne = async (dbMatch: any) => {
      try {
        // Fetch using the frontend worker route for speed and consistency!
        let richData = await fetchEspnDetails(dbMatch.espn_id);

        if (!richData || richData.error) {
          skipped++;
          logs.push(`⚠️ Skipped ${dbMatch.espn_id}: invalid ESPN response`);
          return;
        }

        if (!shouldUpdate(dbMatch, richData)) {
          skipped++;
          logs.push(`⏭️ No DB change ${dbMatch.home_team} vs ${dbMatch.away_team}`);
          return;
        }

        const nowIso = new Date().toISOString();

        const nextEvents =
          Array.isArray(richData.match_events) && richData.match_events.length > 0
            ? richData.match_events
            : Array.isArray(richData.events) && richData.events.length > 0
              ? richData.events
              : dbMatch.match_events || dbMatch.events || [];

        const nextLineups = hasRichLineups(richData.lineups)
          ? richData.lineups
          : dbMatch.lineups || { home: [], away: [], formations: { home: null, away: null } };

        const nextStats = hasRichStats(richData.stats)
          ? richData.stats
          : dbMatch.stats || { home: {}, away: {} };

        const dbStatus = normalizeStatus(dbMatch.status);
        const nextStatus = normalizeStatus(richData.status);

        const statusChanged = dbStatus !== nextStatus;
        const scoresChanged =
          Number(dbMatch.home_score ?? 0) !== Number(richData.home_score ?? 0) ||
          Number(dbMatch.away_score ?? 0) !== Number(richData.away_score ?? 0);

        const oldEvents = dbMatch.match_events || dbMatch.events || [];
        const eventsChanged = stableStringify(oldEvents) !== stableStringify(nextEvents);

        const payload: any = {
          updated_at: nowIso,
          last_live_sync_at: nowIso,
          status: richData.status,
          home_score: richData.home_score,
          away_score: richData.away_score,
          displayClock: richData.displayClock
        };

        const optionalColumns = [
          "match_events",
          "events",
          "stats",
          "lineups",
          "venue",
          "referees",
          "predictor",
          "stage",
          "match_group",
          "match_type",
          "round",
          "group_summary",
          "knockout",
          "final",
          "home_logo",
          "away_logo"
        ];

        for (const col of optionalColumns) {
          if (col in dbMatch) {
            if (col === "match_events") {
              payload.match_events = nextEvents;
            } else if (col === "events") {
              payload.events = nextEvents;
            } else if (col === "stats") {
              payload.stats = nextStats;
            } else if (col === "lineups") {
              payload.lineups = nextLineups;
            } else if (col === "venue") {
              payload.venue = richData.venue ?? dbMatch.venue ?? null;
            } else if (col === "referees") {
              payload.referees = richData.referees ?? dbMatch.referees ?? [];
            } else if (col === "predictor") {
              payload.predictor = richData.predictor ?? dbMatch.predictor ?? null;
            } else if (col === "stage") {
              payload.stage = richData.stage ?? dbMatch.stage ?? null;
            } else if (col === "match_group") {
              payload.match_group = richData.match_group ?? dbMatch.match_group ?? null;
            } else if (col === "match_type") {
              payload.match_type = richData.match_type ?? dbMatch.match_type ?? null;
            } else if (col === "round") {
              payload.round = richData.round ?? dbMatch.round ?? null;
            } else if (col === "group_summary") {
              payload.group_summary = richData.group_summary ?? dbMatch.group_summary ?? [];
            } else if (col === "knockout") {
              payload.knockout = richData.knockout ?? dbMatch.knockout ?? false;
            } else if (col === "final") {
              payload.final = richData.final ?? dbMatch.final ?? false;
            } else if (col === "home_logo") {
              if (richData.home_logo) payload.home_logo = richData.home_logo;
            } else if (col === "away_logo") {
              if (richData.away_logo) payload.away_logo = richData.away_logo;
            }
          }
        }

        const { error: updateError } = await supabase
          .from("matches")
          .update(payload)
          .eq("id", dbMatch.id);

        if (updateError) throw updateError;

        const targetRecord = { ...dbMatch, ...payload };

        const statusChangedToTerminal =
          TERMINAL_STATUSES.has(nextStatus) &&
          !TERMINAL_STATUSES.has(dbStatus);

        if (statusChangedToTerminal || scoresChanged || eventsChanged) {
          fetch(`${url.origin}/api/social`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.CRON_KEY}`
            },
            body: JSON.stringify({
              record: targetRecord,
              old_record: dbMatch
            })
          }).catch(() => {});
        }

        updates++;
        logs.push(`⚡ ESPN Synced: ${dbMatch.home_team} vs ${dbMatch.away_team} -> ${richData.home_score}-${richData.away_score} (${richData.status})`);
      } catch (e: any) {
        failures++;
        logs.push(`⚠️ Failed ${dbMatch.espn_id}: ${e.message}`);
      }
    };

    for (let i = 0; i < activeMatches.length; i += concurrency) {
      const batch = activeMatches.slice(i, i + concurrency);
      await Promise.all(batch.map(updateOne));
    }

    return NextResponse.json({
      success: true,
      updates,
      skipped,
      failures,
      total: activeMatches.length,
      logs: logs.slice(0, 250)
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) { return runLiveUpdate(request); }
export async function POST(request: Request) { return runLiveUpdate(request); }
