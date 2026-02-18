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
  { id: 'EC', name: 'Euros' }, { id: 'WC', name: 'World Cup' }
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

  console.log(`🚀 Starting Safe Schedule Sync: ${fromStr} to ${toStr}`);

  for (const league of LEAGUES) {
    console.log(`\n.. Processing ${league.name}`);
    try {
      const url = `${BASE_URL}/competitions/${league.id}/matches?dateFrom=${fromStr}&dateTo=${toStr}`;
      const res = await fetch(url, { headers: { 'X-Auth-Token': API_KEY } });
      
      if (!res.ok) {
        console.error(`   ❌ Error ${res.status}: ${res.statusText}`);
        if (res.status === 429) await delay(60000); 
      } else {
        const data = await res.json();
        const now = Date.now();

        // 🟢 FILTER: Prepare matches but SKIP live ones
        const matches = (data.matches || []).reduce((acc, m) => {
          
          const matchTime = new Date(m.utcDate).getTime();
          const diffHours = (now - matchTime) / (1000 * 60 * 60);

          // 🛡️ SAFETY LOCK: 
          // If match starts in < 30 mins (-0.5) OR started < 4 hours ago (4.0)
          // We SKIP it. We trust ESPN Live Route to handle this window.
          // This prevents overwriting "1-0 LIVE" with "0-0 SCHEDULED".
          if (diffHours > -0.5 && diffHours < 4.0 && m.status !== 'FINISHED') {
             console.log(`   ⏩ Skipping Active Match: ${m.homeTeam.shortName} vs ${m.awayTeam.shortName}`);
             return acc; // Skip this iteration
          }

          acc.push({
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
            updated_at: new Date().toISOString()
          });
          return acc;
        }, []);

        if (matches.length > 0) {
          const { error } = await supabase.from('matches').upsert(matches, { onConflict: 'api_id' });
          if (error) console.error(`   ❌ DB Error: ${error.message}`);
          else console.log(`   ✅ Synced ${matches.length} matches (Safe Mode).`);
        }
      }
    } catch (e) {
      console.error(`   🔥 Exception: ${e.message}`);
    }
    await delay(10000); 
  }
}

run();