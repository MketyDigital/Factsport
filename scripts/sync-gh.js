const { createClient } = require('@supabase/supabase-js');

// Config
const API_KEY = process.env.FOOTBALL_DATA_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const YOUR_DOMAIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://factsport.com'; 
const CRON_KEY = process.env.CRON_KEY; // 🛡️ Using your existing CRON_KEY

const BASE_URL = 'https://api.football-data.org/v4';
const LEAGUES = [
  { id: 'PL', name: 'Premier League' }, { id: 'PD', name: 'La Liga' },
  { id: 'BL1', name: 'Bundesliga' }, { id: 'SA', name: 'Serie A' },
  { id: 'FL1', name: 'Ligue 1' }, { id: 'CL', name: 'Champions League' },
  { id: 'EC', name: 'Euros' }, { id: 'WC', name: 'World Cup' }
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchSafe(url, options) {
  const res = await fetch(url, options);
  await delay(6200); 
  return res;
}

// 🟢 LOGO SHIELD INTERCEPTOR
async function getSafeLogo(teamName, originalLogoUrl) {
    if (!originalLogoUrl || originalLogoUrl.includes('espncdn') || originalLogoUrl.includes('supabase')) {
        return originalLogoUrl;
    }
    try {
        const res = await fetch(`${YOUR_DOMAIN}/api/logos/sync`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-cron-key': CRON_KEY, // 🛡️ Passing the CRON_KEY to the bouncer
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({ teamName: teamName, logoUrl: originalLogoUrl })
        });
        
        if (!res.ok) throw new Error('API returned an error or unauthorized');
        
        const data = await res.json();
        return data.local_url || originalLogoUrl;
    } catch (e) {
        console.error(`   ⚠️ Logo sync failed for ${teamName}: ${e.message}`);
        return originalLogoUrl;
    }
}

async function run() {
  if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY || !CRON_KEY) {
    console.error('❌ Missing Env Variables');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const today = new Date();
  
  const fromDate = new Date(today); fromDate.setDate(today.getDate() - 3);
  const toDate = new Date(today); toDate.setDate(today.getDate() + 35); // 🟢 Bumped to 35 days
  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];

  console.log(`🚀 Starting SMART Schedule Sync: ${fromStr} to ${toStr}`);

  console.log(`🔍 Checking database for existing rich data...`);
  const { data: dbMatches, error: dbErr } = await supabase
    .from('matches')
    .select('api_id, h2h, venue, referees, stage, match_group')
    .gte('match_date', fromStr)
    .lte('match_date', toStr);

  if (dbErr) console.error(`⚠️ Could not fetch existing matches: ${dbErr.message}`);

  const existingMatches = {};
  (dbMatches || []).forEach(m => existingMatches[m.api_id] = m);

  for (const league of LEAGUES) {
    console.log(`\n.. Processing ${league.name}`);
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
        const now = Date.now();
        const matches = [];
        let newH2hFetches = 0;
        
        for (const m of data.matches || []) {
          const matchTime = new Date(m.utcDate).getTime();
          const diffHours = (now - matchTime) / (1000 * 60 * 60);
          const diffDays = (matchTime - now) / (1000 * 60 * 60 * 24);

          if (diffHours > -0.5 && diffHours < 4.0 && m.status !== 'FINISHED') continue; 

          const existing = existingMatches[m.id];
          let h2hData = existing?.h2h || null;
          
          const isH2hComplete = h2hData && 
                                h2hData.aggregates && 
                                typeof h2hData.aggregates === 'object' && 
                                Object.keys(h2hData.aggregates).length > 0;
          
          if (!isH2hComplete && diffDays >= -1 && diffDays <= 3) {
              try {
                  const h2hUrl = `${BASE_URL}/matches/${m.id}/head2head`;
                  const h2hRes = await fetchSafe(h2hUrl, { headers: { 'X-Auth-Token': API_KEY } });
                  
                  if (h2hRes.ok) {
                      const parsedH2h = await h2hRes.json();
                      if (parsedH2h && parsedH2h.aggregates) {
                          h2hData = { aggregates: parsedH2h.aggregates, matches: parsedH2h.matches || [] }; 
                          newH2hFetches++;
                      }
                  }
              } catch (err) {
                  console.error(`   ❌ Failed to fetch H2H:`, err.message);
              }
          }

          const formattedReferees = m.referees?.map(r => r.name) || existing?.referees || [];

          // 🟢 SECURE LOGO FETCH
          const safeHomeLogo = await getSafeLogo(m.homeTeam.shortName || m.homeTeam.name, m.homeTeam.crest);
          const safeAwayLogo = await getSafeLogo(m.awayTeam.shortName || m.awayTeam.name, m.awayTeam.crest);

          // 🟢 SMART STATUS EVALUATOR (Fixes TBD, Postponed, and World Cup Edge Cases)
          let finalStatus = 'SCHEDULED';
          
          if (m.status === 'FINISHED' || m.status === 'AWARDED') {
              finalStatus = 'FT';
          } else if (m.status === 'IN_PLAY' || m.status === 'PAUSED') {
              finalStatus = m.status;
          } else if (m.status === 'POSTPONED' || m.status === 'CANCELLED' || m.status === 'SUSPENDED') {
              finalStatus = 'POSTPONED';
          } else if (m.status === 'SCHEDULED' && m.utcDate.endsWith('T00:00:00Z')) {
              // The time is not officially confirmed yet. Safe to mark as TBD.
              finalStatus = 'TBD';
          } else if (m.status === 'TIMED') {
              // The time IS confirmed (even if it's genuinely midnight). Normalize for your UI.
              finalStatus = 'SCHEDULED';
          } else {
              finalStatus = m.status; // Safe fallback
          }

          matches.push({
            api_id: m.id,
            league: league.name,
            home_team: m.homeTeam.shortName || m.homeTeam.name,
            away_team: m.awayTeam.shortName || m.awayTeam.name,
            home_score: m.score.fullTime.home ?? 0,
            away_score: m.score.fullTime.away ?? 0,
            match_date: m.utcDate,
            status: finalStatus, 
            home_logo: safeHomeLogo, 
            away_logo: safeAwayLogo, 
            updated_at: new Date().toISOString(),
            venue: m.venue || existing?.venue || null,
            referees: formattedReferees,
            stage: m.stage || existing?.stage || null,
            match_group: m.group || existing?.match_group || null,
            h2h: h2hData
          });
        }

        if (matches.length > 0) {
          const { error } = await supabase.from('matches').upsert(matches, { onConflict: 'api_id' });
          if (error) console.error(`   ❌ DB Error: ${error.message}`);
          else console.log(`   ✅ Synced ${matches.length} matches.`);
        }
      }
    } catch (e) {
      console.error(`   🔥 Exception: ${e.message}`);
    }
    await delay(2000);
  }
}

run();