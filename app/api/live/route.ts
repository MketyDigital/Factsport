// app/api/live/route.ts
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
const PRE_STATUSES = new Set(["SCHEDULED", "PRE", "TIMED", "NS", "UPCOMING", "TBD"]);

const stableStringify = (value: any) => {
  try { return JSON.stringify(value || null); } catch { return ""; }
};

const shouldFetchForMatch = (dbMatch: any, richData: any) => {
  const status = String(dbMatch.status || "").toUpperCase();
  const nextStatus = String(richData.status || "").toUpperCase();

  const kickMs = new Date(dbMatch.match_date).getTime();
  const minutesSinceKick = Number.isFinite(kickMs) ? (Date.now() - kickMs) / 60000 : 999999;
  const staleMinutes = Number(process.env.LIVE_SYNC_STALE_MINUTES || 90);

  const dbScoresPresent = Number.isFinite(Number(dbMatch.home_score)) && Number.isFinite(Number(dbMatch.away_score));
  const scoresChanged = Number(dbMatch.home_score || 0) !== Number(richData.home_score || 0) || Number(dbMatch.away_score || 0) !== Number(richData.away_score || 0);

  if (LIVE_STATUSES.has(nextStatus)) return true;
  if (TERMINAL_STATUSES.has(nextStatus)) {
    if (!TERMINAL_STATUSES.has(status) || !dbScoresPresent || scoresChanged) return true;
    return false;
  }
  if (LIVE_STATUSES.has(status)) return true;
  if (PRE_STATUSES.has(status) || status === "") {
    if (minutesSinceKick >= -150 && minutesSinceKick <= 150) return true;
    if (minutesSinceKick > staleMinutes) return true;
    return false;
  }
  return false;
};

async function runLiveUpdate(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== process.env.CRON_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const logs: string[] = [];
  let updates = 0;

  try {
    const lookBackDays = Number(process.env.LIVE_SYNC_LOOKBACK_DAYS || 1);
    const lookForwardDays = Number(process.env.LIVE_SYNC_LOOKAHEAD_DAYS || 2);
    const lookBack = new Date(Date.now() - lookBackDays * 24 * 60 * 60 * 1000).toISOString();
    const lookForward = new Date(Date.now() + lookForwardDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: windowMatches, error: fetchError } = await supabase
      .from("matches")
      .select("*")
      .not("espn_id", "is", null)
      .gte("match_date", lookBack)
      .lte("match_date", lookForward);

    if (fetchError) throw fetchError;
    if (!windowMatches || windowMatches.length === 0) return NextResponse.json({ message: "No matches in window." });

    const activeMatches = windowMatches.filter((m: any) => {
      const status = String(m.status || "").toUpperCase();
      if (TERMINAL_STATUSES.has(status) && Number.isFinite(Number(m.home_score)) && m.lineups?.home?.length > 0) return false;
      return true;
    });

    const pool: Promise<any>[] = [];
    const concurrency = Number(process.env.LIVE_SYNC_CONCURRENCY || 3);

    const updateOne = async (dbMatch: any) => {
      try {
        const richData = await fetchEspnDetails(dbMatch.espn_id);
        if (!richData || !shouldFetchForMatch(dbMatch, richData)) return;

        const payload: any = {
          updated_at: new Date().toISOString(),
          last_live_sync_at: new Date().toISOString(),
          status: richData.status,
          home_score: richData.home_score,
          away_score: richData.away_score,
          displayClock: richData.displayClock,
          match_events: richData.match_events || richData.events || [],
          events: richData.events || richData.match_events || [],
          stats: richData.stats || { home: {}, away: {} },
          lineups: richData.lineups || { home: [], away: [], formations: { home: null, away: null } },
          venue: richData.venue,
          referees: richData.referees,
          predictor: richData.predictor || null,
          stage: richData.stage,
          match_group: richData.match_group,
          match_type: richData.match_type,
          round: richData.round,
          group_summary: richData.group_summary || [],
          knockout: Boolean(richData.knockout),
          final: Boolean(richData.final)
        };

        if (richData.home_logo) payload.home_logo = richData.home_logo;
        if (richData.away_logo) payload.away_logo = richData.away_logo;

        await supabase.from("matches").update(payload).eq("id", dbMatch.id);
        
        const targetRecord = { ...dbMatch, ...payload };
        const statusChangedToFT = TERMINAL_STATUSES.has(String(targetRecord.status).toUpperCase()) && !TERMINAL_STATUSES.has(String(dbMatch.status).toUpperCase());
        const scoresChanged = Number(targetRecord.home_score) !== Number(dbMatch.home_score) || Number(targetRecord.away_score) !== Number(dbMatch.away_score);
        
        if (statusChangedToFT || scoresChanged) {
          fetch(`${url.origin}/api/social`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CRON_KEY}` },
            body: JSON.stringify({ record: targetRecord, old_record: dbMatch })
          }).catch(() => {});
        }

        updates++;
        logs.push(`⚡ ESPN Synced: ${dbMatch.home_team} vs ${dbMatch.away_team}`);
      } catch (e: any) {
        logs.push(`⚠️ Failed ${dbMatch.espn_id}: ${e.message}`);
      }
    };

    for (const dbMatch of activeMatches) {
      pool.push(updateOne(dbMatch));
      if (pool.length >= concurrency) await Promise.all(pool.splice(0, pool.length));
    }
    await Promise.all(pool);
    return NextResponse.json({ success: true, updates, logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) { return runLiveUpdate(request); }
export async function POST(request: Request) { return runLiveUpdate(request); }