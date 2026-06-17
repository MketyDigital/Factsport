// @ts-nocheck
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_KEY = process.env.CRON_KEY;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

/**
 * Fetches match details directly from the ESPN site/web API
 * to serve as a reliable standalone parser.
 */
async function fetchEspnDetailsLocal(espnId) {
  if (!espnId) return null;
  try {
    const res = await fetch(`https://site.web.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${espnId}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.header) return null;

    const competition = data.header.competitions?.[0] || {};
    const statusType = competition.status?.type || {};
    
    let status = statusType.shortDetailValue || statusType.detail || statusType.name || "PRE";
    const state = statusType.state || "pre";
    if (state === "in") status = "LIVE";
    else if (state === "post") status = "FT";
    else if (state === "pre") status = "PRE";

    const competitors = competition.competitors || [];
    const homeComp = competitors.find((c) => c.homeAway === "home");
    const awayComp = competitors.find((c) => c.homeAway === "away");

    return {
      status,
      home_score: homeComp ? Number(homeComp.score ?? 0) : 0,
      away_score: awayComp ? Number(awayComp.score ?? 0) : 0,
      displayClock: competition.status?.displayClock || statusType.detail || "",
      match_events: (data.keyEvents || []).map(e => ({
        id: e.id,
        time: e.clock?.displayValue || "",
        text: e.text || "",
        type: (e.type?.text || "").toLowerCase().includes("goal") ? "goal" : "other",
        player: e.players?.[0]?.displayName || ""
      })),
      stats: {
        home: {},
        away: {}
      },
      lineups: {
        home: [],
        away: []
      }
    };
  } catch (err) {
    console.error(`ESPN fetch error in helper for ${espnId}:`, err.message);
    return null;
  }
}

/**
 * Clean Supabase bypass database synchronization fallback.
 * Only runs if the main application server is down or returns a non-200.
 */
async function runDirectWorkerBackup() {
  console.log('🤖 Starting direct Sync backup...');
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase keys in local environment.');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const lookBackDays = Number(process.env.LIVE_SYNC_LOOKBACK_DAYS || 1);
  const lookForwardDays = Number(process.env.LIVE_SYNC_LOOKAHEAD_DAYS || 2);

  const lookBack = new Date(Date.now() - lookBackDays * 24 * 60 * 60 * 1000).toISOString();
  const lookForward = new Date(Date.now() + lookForwardDays * 24 * 60 * 60 * 1000).toISOString();

  console.log(`Querying match entries between ${lookBack} and ${lookForward}`);

  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .not('espn_id', 'is', null)
    .gte('match_date', lookBack)
    .lte('match_date', lookForward);

  if (error) {
    console.error('❌ Error querying matches:', error.message);
    return;
  }

  if (!matches || matches.length === 0) {
    console.log('💤 No ESPN-mapped matches in active window.');
    return;
  }

  console.log(`Found ${matches.length} matches mapped to ESPN. Checking updates...`);

  for (const m of matches) {
    try {
      const richData = await fetchEspnDetailsLocal(m.espn_id);
      if (!richData) continue;

      if (Number(m.home_score) !== Number(richData.home_score) || Number(m.away_score) !== Number(richData.away_score) || m.status !== richData.status) {
        console.log(`⚡ Updating: ${m.home_team} vs ${m.away_team} (${richData.home_score}-${richData.away_score})`);
        
        await supabase
          .from('matches')
          .update({
            home_score: richData.home_score,
            away_score: richData.away_score,
            status: richData.status,
            displayClock: richData.displayClock,
            updated_at: new Date().toISOString()
          })
          .eq('id', m.id);
      }
    } catch (e) {
      console.warn(`Could not sync match ${m.id}:`, e.message);
    }
  }
}

/**
 * Main routine: Attempts to trigger the application's unified live API sync first,
 * or runs the direct worker database backup on failure.
 */
async function triggerLiveWorker() {
  console.log('⏳ Worker waking up to trigger score synchronize...');
  
  const targetUrl = `${APP_URL.replace(/\/$/, '')}/api/live?key=${CRON_KEY || 'default_key'}`;
  console.log(`Triggering LIVE sync endpoint: ${targetUrl.replace(/key=[^&]+/, 'key=***')}`);
  
  try {
    const res = await fetch(targetUrl, { method: 'POST' });
    const text = await res.text();
    
    if (res.status === 200) {
      console.log('✅ Worker successfully triggered live API update:', text);
    } else {
      console.warn(`⚠️ API responded with non-200 status (${res.status}): ${text}. Running fallback...`);
      await runDirectWorkerBackup();
    }
  } catch (e) {
    console.warn(`🔥 Failed to connect to server endpoint: ${e.message}. Running direct sync bypass...`);
    await runDirectWorkerBackup();
  }
  
  console.log('🚀 Worker cycle completed.');
}

triggerLiveWorker();