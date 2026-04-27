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

async function fetchSafe(url, options) {
  const res = await fetch(url, options);
  await delay(6200); 
  return res;
}

// 🟢 NATIVE LOGO SHIELD: Bypasses your API entirely!
async function getSafeLogo(teamName, originalLogoUrl, supabase) {
    if (!originalLogoUrl || originalLogoUrl.includes('espncdn') || originalLogoUrl.includes('supabase')) {
        return originalLogoUrl;
    }
    try {
        const { data: existing } = await supabase
            .from('team_logos')
            .select('local_url')
            .eq('team_name', teamName)
            .single();
            
        if (existing?.local_url) return existing.local_url;

        // Download the image natively in the script
        const imageRes = await fetch(originalLogoUrl);
        if (!imageRes.ok) throw new Error('Failed to download image from source');
        
        const arrayBuffer = await imageRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer); 
        const safeFileName = `${teamName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}-${Date.now()}.png`;

        // Upload to Supabase using the Service Key
        const { error: uploadError } = await supabase.storage
            .from('team-logos')
            .upload(`public/${safeFileName}`, buffer, { 
                contentType: 'image/png', 
                upsert: true
            });
        
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('team-logos').getPublicUrl(`public/${safeFileName}`);

        await supabase.from('team_logos').insert([{
            team_name: teamName,
            original_url: originalLogoUrl,
            local_url: publicUrl
        }]);

        return publicUrl;
    } catch (e) {
        console.error(`   ⚠️ Logo sync failed for ${teamName}: ${e.message}`);
        return originalLogoUrl;
    }
}

async function run() {
  if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Env Variables');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const today = new Date();
  
  const fromDate = new Date(today); fromDate.setDate(today.getDate() - 3);
  const toDate = new Date(today); toDate.setDate(today.getDate() + 35); 
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
    
    // ==========================================
    // 🟢 NEW: FETCH AND UPDATE STANDINGS
    // ==========================================
    try {
        const stdUrl = `${BASE_URL}/competitions/${league.id}/standings`;
        let stdRes = await fetch(stdUrl, { headers: { 'X-Auth-Token': API_KEY } });
        
        if (stdRes.status === 429) {
            console.error(`   ⚠️ Rate limit hit on standings. Backing off 60s...`);
            await delay(60000);
            stdRes = await fetch(stdUrl, { headers: { 'X-Auth-Token': API_KEY } });
        }

        if (stdRes.ok) {
            const stdData = await stdRes.json();
            const totalStandings = stdData.standings?.find((s) => s.type === 'TOTAL');
            
            if (totalStandings && totalStandings.table) {
                const standingsToInsert = [];
                for (const row of totalStandings.table) {
                    const safeCrest = await getSafeLogo(row.team.shortName || row.team.name, row.team.crest, supabase);

                    standingsToInsert.push({
                        league_code: league.id,
                        team_id: row.team.id,
                        position: row.position,
                        team_name: row.team.name,
                        team_short_name: row.team.shortName || row.team.name,
                        team_crest: safeCrest,
                        played_games: row.playedGames,
                        won: row.won,
                        draw: row.draw,
                        lost: row.lost,
                        goal_difference: row.goalDifference,
                        points: row.points,
                        updated_at: new Date().toISOString()
                    });
                }
                
                if (standingsToInsert.length > 0) {
                    // Safe approach: clear old league table data and insert fresh accurate data
                    await supabase.from('standings').delete().eq('league_code', league.id);
                    const { error: stdErr } = await supabase.from('standings').insert(standingsToInsert);
                    if (stdErr) console.error(`   ❌ DB Error saving standings: ${stdErr.message}`);
                    else console.log(`   ✅ Synced Standings for ${league.name}`);
                }
            }
        } else {
             console.error(`   ❌ Failed to fetch standings: ${stdRes.status} ${stdRes.statusText}`);
        }
    } catch (e) {
        console.error(`   🔥 Exception during standings sync: ${e.message}`);
    }
    
    // Give the API a breather before fetching matches
    await delay(2000);

    // ==========================================
    // 🟢 EXISTING MATCHES SYNC LOGIC
    // ==========================================
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
                      }
                  }
              } catch (err) {
                  console.error(`   ❌ Failed to fetch H2H:`, err.message);
              }
          }

          const formattedReferees = m.referees?.map(r => r.name) || existing?.referees || [];

          // 🟢 Pass the initialized Supabase client to the Logo script
          const safeHomeLogo = await getSafeLogo(m.homeTeam.shortName || m.homeTeam.name, m.homeTeam.crest, supabase);
          const safeAwayLogo = await getSafeLogo(m.awayTeam.shortName || m.awayTeam.name, m.awayTeam.crest, supabase);

          let finalStatus = 'SCHEDULED';
          if (m.status === 'FINISHED' || m.status === 'AWARDED') finalStatus = 'FT';
          else if (m.status === 'IN_PLAY' || m.status === 'PAUSED') finalStatus = m.status;
          else if (m.status === 'POSTPONED' || m.status === 'CANCELLED' || m.status === 'SUSPENDED') finalStatus = 'POSTPONED';
          else if (m.status === 'SCHEDULED' && m.utcDate.endsWith('T00:00:00Z')) finalStatus = 'TBD';
          else if (m.status === 'TIMED') finalStatus = 'SCHEDULED';
          else finalStatus = m.status; 

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