// scripts/sync-gh.js

const { createClient } = require('@supabase/supabase-js');

const API_KEY = process.env.FOOTBALL_DATA_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BASE_URL = 'https://api.football-data.org/v4';

const LEAGUES = [
  { id: 'PL', name: 'Premier League' },
  { id: 'PD', name: 'La Liga' },
  { id: 'BL1', name: 'Bundesliga' },
  { id: 'SA', name: 'Serie A' },
  { id: 'FL1', name: 'Ligue 1' },
  { id: 'CL', name: 'Champions League' },
  { id: 'EC', name: 'Euros' },
  { id: 'WC', name: 'World Cup' }
];

if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Env Variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeName = (name) =>
  String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const canonicalKey = (home, away, date) =>
  `${normalizeName(home)}|${normalizeName(away)}|${date.toISOString().split('T')[0]}`;

const isReversedFixture = (aHome, aAway, bHome, bAway) =>
  normalizeName(aHome) === normalizeName(bAway) && normalizeName(aAway) === normalizeName(bHome);

const isSameFixture = (aHome, aAway, bHome, bAway) =>
  (
    normalizeName(aHome) === normalizeName(bHome) &&
    normalizeName(aAway) === normalizeName(bAway)
  ) || isReversedFixture(aHome, aAway, bHome, bAway);

async function fetchSafe(url, options) {
  const res = await fetch(url, options);
  await delay(6200);
  return res;
}

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

    const imageRes = await fetch(originalLogoUrl);
    if (!imageRes.ok) throw new Error('Failed to download image from source');

    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeFileName = `${teamName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from('team-logos')
      .upload(`public/${safeFileName}`, buffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('team-logos')
      .getPublicUrl(`public/${safeFileName}`);

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

async function findExistingForFdMatch(supabase, league, m, candidateCache) {
  const { data: byApi } = await supabase
    .from('matches')
    .select('id, api_id, espn_id, home_team, away_team, match_date')
    .eq('api_id', m.id)
    .limit(1);

  if (byApi?.[0]) return byApi[0];

  const matchDate = new Date(m.utcDate);
  const dayStart = new Date(matchDate);
  dayStart.setUTCHours(0, 0, 0, 0);

  const dayEnd = new Date(matchDate);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const key = canonicalKey(m.homeTeam.name, m.awayTeam.name, matchDate);

  if (candidateCache.has(key)) return candidateCache.get(key);

  const { data: candidates } = await supabase
    .from('matches')
    .select('id, api_id, espn_id, home_team, away_team, match_date')
    .eq('league', league.name)
    .gte('match_date', dayStart.toISOString())
    .lte('match_date', dayEnd.toISOString());

  const found = (candidates || []).find((c) =>
    isSameFixture(c.home_team, c.away_team, m.homeTeam.name, m.awayTeam.name)
  );

  if (found) candidateCache.set(key, found);

  return found || null;
}

async function run() {
  const today = new Date();

  const fromDate = new Date(today);
  fromDate.setDate(today.getDate() - 3);

  const toDate = new Date(today);
  toDate.setDate(today.getDate() + 35);

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
  (dbMatches || []).forEach((m) => {
    existingMatches[m.api_id] = m;
  });

  for (const league of LEAGUES) {
    console.log(`\n.. Processing ${league.name}`);

    try {
      const url = `${BASE_URL}/competitions/${league.id}/matches?dateFrom=${fromStr}&dateTo=${toStr}`;

      let res = await fetch(url, {
        headers: { 'X-Auth-Token': API_KEY }
      });

      if (res.status === 429) {
        console.error('   ⚠️ Rate limit hit. Backing off 60s...');
        await delay(60000);

        res = await fetch(url, {
          headers: { 'X-Auth-Token': API_KEY }
        });
      }

      if (!res.ok) {
        console.error(`   ❌ Error ${res.status}: ${res.statusText}`);
        continue;
      }

      const data = await res.json();
      const now = Date.now();
      const matches = [];
      const candidateCache = new Map();

      for (const m of data.matches || []) {
        const matchTime = new Date(m.utcDate).getTime();
        const diffHours = (now - matchTime) / (1000 * 60 * 60);
        const diffDays = (matchTime - now) / (1000 * 60 * 60 * 24);

        if (diffHours > -0.5 && diffHours < 4.0 && m.status !== 'FINISHED') continue;

        const existing = await findExistingForFdMatch(supabase, league, m, candidateCache);
        let h2hData = existing?.h2h || null;

        const isH2hComplete =
          h2hData &&
          h2hData.aggregates &&
          typeof h2hData.aggregates === 'object' &&
          Object.keys(h2hData.aggregates).length > 0;

        if (!isH2hComplete && diffDays >= -1 && diffDays <= 3) {
          try {
            const h2hUrl = `${BASE_URL}/matches/${m.id}/head2head`;
            const h2hRes = await fetchSafe(h2hUrl, {
              headers: { 'X-Auth-Token': API_KEY }
            });

            if (h2hRes.ok) {
              const parsedH2h = await h2hRes.json();

              if (parsedH2h && parsedH2h.aggregates) {
                h2hData = {
                  aggregates: parsedH2h.aggregates,
                  matches: parsedH2h.matches || []
                };
              }
            }
          } catch (err) {
            console.error(`   ❌ Failed to fetch H2H: ${err.message}`);
          }
        }

        const formattedReferees = m.referees?.map((r) => r.name) || existing?.referees || [];

        let safeHomeLogo = await getSafeLogo(
          m.homeTeam.shortName || m.homeTeam.name,
          m.homeTeam.crest,
          supabase
        );

        let safeAwayLogo = await getSafeLogo(
          m.awayTeam.shortName || m.awayTeam.name,
          m.awayTeam.crest,
          supabase
        );

        if ((!safeHomeLogo || !String(safeHomeLogo).includes('http')) && existing?.home_logo) {
          safeHomeLogo = existing.home_logo;
        }

        if ((!safeAwayLogo || !String(safeAwayLogo).includes('http')) && existing?.away_logo) {
          safeAwayLogo = existing.away_logo;
        }

        let finalStatus = 'SCHEDULED';

        if (m.status === 'FINISHED' || m.status === 'AWARDED') finalStatus = 'FT';
        else if (m.status === 'IN_PLAY' || m.status === 'PAUSED') finalStatus = m.status;
        else if (m.status === 'POSTPONED' || m.status === 'CANCELLED' || m.status === 'SUSPENDED') finalStatus = 'POSTPONED';
        else if (m.status === 'SCHEDULED' && m.utcDate.endsWith('T00:00:00Z')) finalStatus = 'TBD';
        else if (m.status === 'TIMED') finalStatus = 'SCHEDULED';
        else finalStatus = m.status;

        const homeScoreFd = m.score?.fullTime?.home ?? 0;
        const awayScoreFd = m.score?.fullTime?.away ?? 0;

        let statusToSave = finalStatus;
        let homeScoreToSave = homeScoreFd;
        let awayScoreToSave = awayScoreFd;

        const existingStatus = String(existing?.status || '').toUpperCase();
        const fdIsFinished = ['FT', 'FINISHED', 'AWARDED', 'AET', 'PEN', 'ABD'].includes(finalStatus);

        if (existing?.espn_id && !fdIsFinished) {
          statusToSave = existingStatus || finalStatus;
          homeScoreToSave = existing.home_score ?? homeScoreFd;
          awayScoreToSave = existing.away_score ?? awayScoreFd;
        }

        let apiIdToSave = String(m.id);

        if (existing) {
          const existingApi = String(existing.api_id || '');
          const existingEspn = String(existing.espn_id || '');

          if (existingApi && existingApi !== existingEspn) {
            apiIdToSave = existingApi;
          } else {
            apiIdToSave = String(m.id);
          }
        }

        matches.push({
          id: existing?.id,
          api_id: apiIdToSave,
          espn_id: existing?.espn_id || null,
          league: league.name,
          home_team: existing?.home_team || m.homeTeam.shortName || m.homeTeam.name,
          away_team: existing?.away_team || m.awayTeam.shortName || m.awayTeam.name,
          home_score: homeScoreToSave,
          away_score: awayScoreToSave,
          match_date: m.utcDate,
          status: statusToSave,
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

      let synced = 0;
      let updated = 0;
      let inserted = 0;

      for (const match of matches) {
        let result;

        if (match.id) {
          const { id, ...payload } = match;

          result = await supabase
            .from('matches')
            .update(payload)
            .eq('id', id);

          updated++;
        } else {
          const { id, ...payload } = match;

          result = await supabase.from('matches').insert(payload);
          inserted++;
        }

        if (result.error) {
          console.error(`   ❌ DB Error: ${result.error.message}`);
        } else {
          synced++;
        }
      }

      if (synced > 0) {
        console.log(`   ✅ Synced ${synced} matches for ${league.name} (${updated} updated, ${inserted} inserted).`);
      } else {
        console.log(`   💤 No matches synced for ${league.name}.`);
      }
    } catch (e) {
      console.error(`   🔥 Exception: ${e.message}`);
    }

    await delay(2000);
  }
}

run();