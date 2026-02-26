// scripts/sync-gh.js
const { createClient } = require('@supabase/supabase-js');

// Config
const API_KEY = process.env.FOOTBALL_DATA_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BASE_URL = 'https://api.football-data.org/v4';
const LEAGUES = [
  { id: 'PL', name: 'Premier League' }, { id: 'PD', name: 'La Liga' },
  { id: 'BL1', name: 'Bundesliga' }, { id: 'SA', name: 'Serie A' },
  { id: 'FL1', name: 'Ligue 1' }, { id: 'CL', name: 'Champions League' },
  { id: 'EC', name: 'Euros' }, { id: 'WC', name: 'World Cup' },
  { id: 'EL', name: 'Europa League' } 
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Safe fetch for when we ACTUALLY need to hit the API
async function fetchSafe(url, options) {
  const res = await fetch(url, options);
  await delay(8000); // 8-second delay ensures we stay under 10/min
  return res;
}

async function run() {
  if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Env Variables');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Sync Range: -14 days (History) to +21 days (Schedule)
  const today = new Date();
  const fromDate = new Date(today); fromDate.setDate(today.getDate() - 14);
  const toDate = new Date(today); toDate.setDate(today.getDate() + 21);
  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];

  console.log(`🚀 Starting SMART Schedule Sync: ${fromStr} to ${toStr}`);

  // 🟢 1. PRE-FETCH EXISTING DATA FROM DB
  // We get what we already have to avoid redundant API calls
  console.log(`🔍 Checking database for existing rich data...`);
  const { data: dbMatches, error: dbErr } = await supabase
    .from('matches')
    .select('api_id, h2h, venue, referees, stage, match_group')
    .gte('match_date', fromStr)
    .lte('match_date', toStr);

  if (dbErr) console.error(`⚠️ Could not fetch existing matches: ${dbErr.message}`);

  // Create a quick lookup map: { 12345: { h2h: {...}, venue: '...' } }
  const existingMatches = {};
  (dbMatches || []).forEach(m => existingMatches[m.api_id] = m);

  for (const league of LEAGUES) {
    console.log(`\n.. Processing ${league.name}`);
    try {
      const url = `${BASE_URL}/competitions/${league.id}/matches?dateFrom=${fromStr}&dateTo=${toStr}`;
      
      // We don't need fetchSafe here, regular fetch is fine for the 9 league calls
      let res = await fetch(url, { headers: { 'X-Auth-Token': API_KEY } });
      
      if (res.status === 429) {
        console.error(`   ⚠️ Rate limit hit on main schedule. Backing off 60s...`);
        await delay(60000); 
        res = await fetch(url, { headers: { 'X-Auth-Token': API_KEY } });
      }

      if (!res.ok) {
        console.error(`   ❌ Error ${res.status}: ${res.statusText}`);
      } else {
        const data = await res.json();
        const now = Date.now();
        const matches = [];
        let newH2hFetches = 0;
        
        for (const m of data.matches || []) {
          const matchTime = new Date(m.utcDate).getTime();
          const diffHours = (now - matchTime) / (1000 * 60 * 60);

          // 🛡️ SAFETY LOCK: Skip active matches
          if (diffHours > -0.5 && diffHours < 4.0 && m.status !== 'FINISHED') {
             continue; 
          }

          // 🟢 2. CHECK IF WE ALREADY HAVE THIS DATA
          const existing = existingMatches[m.id];
          let h2hData = existing?.h2h || null;
          
          // If we don't have the H2H data yet, ONLY THEN do we fetch it safely
          if (!h2hData) {
              try {
                 const h2hUrl = `${BASE_URL}/matches/${m.id}/head2head`;
                 const h2hRes = await fetchSafe(h2hUrl, { headers: { 'X-Auth-Token': API_KEY } });
                 
                 if (h2hRes.ok) {
                     const parsedH2h = await h2hRes.json();
                     h2hData = parsedH2h.aggregates || parsedH2h; 
                     newH2hFetches++;
                 }
              } catch (err) {
                 console.error(`   ❌ Failed to fetch H2H for ${m.id}:`, err.message);
              }
          }

          matches.push({
            api_id: m.id,
            league: league.name,
            home_team: m.homeTeam.shortName || m.homeTeam.name,
            away_team: m.awayTeam.shortName || m.awayTeam.name,
            home_score: m.score.fullTime.home ?? 0,
            away_score: m.score.fullTime.away ?? 0,
            match_date: m.utcDate,
            status: (m.status === 'FINISHED' || m.status === 'AWARDED') ? 'FT' : 'SCHEDULED', 
            home_logo: m.homeTeam.crest,
            away_logo: m.awayTeam.crest,
            updated_at: new Date().toISOString(),
            
            // 🟢 Merge API data with what we might already have in the DB
            venue: m.venue || existing?.venue || null,
            referees: m.referees?.length ? m.referees : (existing?.referees || []),
            stage: m.stage || existing?.stage || null,
            match_group: m.group || existing?.match_group || null,
            h2h: h2hData
          });
        }

        if (matches.length > 0) {
          const { error } = await supabase.from('matches').upsert(matches, { onConflict: 'api_id' });
          if (error) console.error(`   ❌ DB Error: ${error.message}`);
          else {
              console.log(`   ✅ Synced ${matches.length} matches.`);
              if (newH2hFetches > 0) console.log(`   📡 Fetched H2H data for ${newH2hFetches} NEW matches.`);
          }
        }
      }
    } catch (e) {
      console.error(`   🔥 Exception: ${e.message}`);
    }
    // Minor pause between leagues just to be safe
    await delay(2000);
  }
}

run();