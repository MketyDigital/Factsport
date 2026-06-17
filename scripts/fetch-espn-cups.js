// scripts/fetch-espn-cups.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase Keys.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ESPN_CUPS = {
  'Europa League': 'uefa.europa',
  'Europa Conference League': 'uefa.conference',
  'FA Cup': 'eng.fa',
  'Carabao Cup': 'eng.league_cup',
  'Copa del Rey': 'esp.copa_del_rey',
  'Coppa Italia': 'ita.copa_italia',
  'Coupe de France': 'fra.coupe_de_france',
  'DFB-Pokal': 'ger.dfb_pokal',
  'International Friendlies': 'fifa.friendly',
  'UEFA Nations League': 'uefa.nations',
  'CONCACAF Nations League': 'concacac.nations',
  'World Cup Qualifiers (CONMEBOL)': 'fifa.worldq.conmebol',
  'World Cup Qualifiers (UEFA)': 'fifa.worldq.uefa',
  'World Cup Qualifiers (AFC)': 'fifa.worldq.afc',
  'World Cup Qualifiers (CONCACAF)': 'fifa.worldq.concacaf',
  'AFCON Qualifiers': 'caf.nations_qual',
  'Copa America': 'conmebol.america'
};

const normalizeName = (name) =>
  String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeEspnStatus = (state, matchDate) => {
  const matchTime = new Date(matchDate).getTime();
  const now = Date.now();

  if (matchTime > now + 60 * 60 * 1000 && state === 'post') {
    return 'SCHEDULED';
  }

  if (state === 'pre') return 'SCHEDULED';
  if (state === 'in') return 'LIVE';
  if (state === 'post') return 'FT';

  return 'SCHEDULED';
};

const isFakeMatch = (homeName, awayName) => {
  const combined = `${homeName} ${awayName}`.toLowerCase();

  return (
    combined.includes(' u1') ||
    combined.includes(' u2') ||
    combined.includes('esports') ||
    combined.includes('women')
  );
};

const safeScore = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

async function findExistingByEspnId(espnId) {
  const { data } = await supabase
    .from('matches')
    .select('id, api_id, espn_id, league, home_team, away_team')
    .eq('espn_id', espnId)
    .limit(1);

  return data?.[0] || null;
}

async function fetchEspnCups() {
  console.log('🏆 Starting ESPN Cup Sync (-3 to +35 Days)...');

  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(today.getDate() - 3);

  const toDate = new Date(today);
  toDate.setDate(today.getDate() + 35);

  const fromStr = fromDate.toISOString().split('T')[0].replace(/-/g, '');
  const toStr = toDate.toISOString().split('T')[0].replace(/-/g, '');
  const datesParam = `${fromStr}-${toStr}`;

  for (const [leagueName, espnCode] of Object.entries(ESPN_CUPS)) {
    console.log(`\n📡 Fetching ${leagueName}...`);

    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${espnCode}/scoreboard?dates=${datesParam}`;

    try {
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      const events = data.events || [];

      if (events.length === 0) {
        console.log('   💤 No matches found.');
        continue;
      }

      let synced = 0;
      let updated = 0;
      let inserted = 0;

      for (const e of events) {
        const espnId = String(e.id);
        const competition = e.competitions?.[0] || {};
        const homeCompetitor = competition.competitors?.find((c) => c.homeAway === 'home');
        const awayCompetitor = competition.competitors?.find((c) => c.homeAway === 'away');

        const homeName = homeCompetitor?.team?.displayName || 'Home Team';
        const awayName = awayCompetitor?.team?.displayName || 'Away Team';

        if (isFakeMatch(homeName, awayName)) continue;

        const existing = await findExistingByEspnId(espnId);

        const payload = {
          api_id: existing?.api_id || espnId,
          espn_id: espnId,
          league: existing?.league || leagueName,
          home_team: existing?.home_team || homeName,
          away_team: existing?.away_team || awayName,
          home_score: safeScore(homeCompetitor?.score),
          away_score: safeScore(awayCompetitor?.score),
          match_date: e.date,
          status: normalizeEspnStatus(e.status?.type?.state, e.date),
          home_logo: homeCompetitor?.team?.logo || null,
          away_logo: awayCompetitor?.team?.logo || null,
          updated_at: new Date().toISOString()
        };

        let result;

        if (existing) {
          result = await supabase
            .from('matches')
            .update(payload)
            .eq('id', existing.id);

          updated++;
        } else {
          result = await supabase.from('matches').insert(payload);
          inserted++;
        }

        if (result.error) {
          console.error(`   ❌ DB Error for ${espnId}: ${result.error.message}`);
        } else {
          synced++;
        }
      }

      console.log(`   ✅ Synced ${synced} matches for ${leagueName} (${updated} updated, ${inserted} inserted)`);
    } catch (err) {
      console.error(`   🔥 Error fetching ${leagueName}: ${err.message}`);
    }
  }

  console.log('\n🏁 ESPN Cup Sync Complete!');
}

fetchEspnCups();