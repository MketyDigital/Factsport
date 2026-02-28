// scripts/sync-ft-only.js
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

  // 🚀 LIGHTWEIGHT: Only check the last 48 hours for missed finished games
  const today = new Date();
  const fromDate = new Date(today); fromDate.setDate(today.getDate() - 2);
  const toDate = new Date(today); // Up to today

  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];

  console.log(`🚀 Starting FT-ONLY Fallback Sync: ${fromStr} to ${toStr}`);

  for (const league of LEAGUES) {
    console.log(`\n.. Checking ${league.name} for finished matches`);
    try {
      const url = `${BASE_URL}/competitions/${league.id}/matches?dateFrom=${fromStr}&dateTo=${toStr}`;
      
      let res = await fetch(url, { headers: { 'X-Auth-Token': API_KEY } });
      
      if (res.status === 429) {
        console.error(`   ⚠️ Rate limit hit. Backing off 60s...`);
        await delay(60000); 
        res = await fetch(url, { headers: { 'X-Auth-Token': API_KEY } });
      }

      if (!res.ok) {
        console.error(`   ❌ Error ${res.status}: ${res.statusText}`);
      } else {
        const data = await res.json();
        const matchesToUpdate = [];
        
        for (const m of data.matches || []) {
          // 🚀 STRICT FILTER: Only care if the match is completely finished
          if (m.status !== 'FINISHED' && m.status !== 'AWARDED') continue; 

          matchesToUpdate.push({
            api_id: m.id,
            home_score: m.score.fullTime.home ?? 0,
            away_score: m.score.fullTime.away ?? 0,
            status: 'FT',
            updated_at: new Date().toISOString()
            // Note: We don't overwrite H2H, Venue, Referees, etc. 
            // We just ensure the score and status are settled.
          });
        }

        if (matchesToUpdate.length > 0) {
          // Upsert only updates the fields we pass in based on api_id
          const { error } = await supabase.from('matches').upsert(matchesToUpdate, { onConflict: 'api_id' });
          if (error) {
              console.error(`   ❌ DB Error: ${error.message}`);
          } else {
              console.log(`   ✅ Settled/Verified ${matchesToUpdate.length} Full-Time matches.`);
          }
        } else {
            console.log(`   ➖ No recently finished matches found.`);
        }
      }
    } catch (e) {
      console.error(`   🔥 Exception: ${e.message}`);
    }
    
    // 7-second delay ensures we never hit the 10 req/min limit (60s / 10 = 6s)
    await delay(7000);
  }
  
  console.log(`\n🏁 FT Fallback Sync Complete!`);
}

run();