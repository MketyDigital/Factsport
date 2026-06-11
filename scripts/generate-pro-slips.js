// scripts/generate-pro-slips.js

// @ts-nocheck
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.FOOTBALL_DATA_API_KEY || process.env.FOOTBALL_DATA_KEY || process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) {
  console.error('❌ Missing Keys. Make sure SUPABASE, GEMINI, and FOOTBALL_DATA keys are set.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

const proSlipSchema = {
  type: SchemaType.OBJECT,
  properties: {
    primary: { type: SchemaType.STRING, description: 'e.g., Over 2.5 Goals' },
    odds: { type: SchemaType.STRING, description: 'e.g., 1.60' },
    safe: { type: SchemaType.STRING, description: 'e.g., Home Win or Draw' },
    safeOdds: { type: SchemaType.STRING, description: 'e.g., 1.20' },
    rationale: { type: SchemaType.STRING, description: '40-50 words of expert tactical rationale.' }
  },
  required: ['primary', 'odds', 'safe', 'safeOdds', 'rationale']
};

const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: proSlipSchema
  }
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const escapeHTML = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const ESPN_LEAGUES = {
  'Premier League': 'eng.1',
  'La Liga': 'esp.1',
  'Bundesliga': 'ger.1',
  'Serie A': 'ita.1',
  'Ligue 1': 'fra.1',
  'Champions League': 'uefa.champions',
  'Europa League': 'uefa.europa',
  'Europa Conference League': 'uefa.conference',
  'FA Cup': 'eng.fa',
  'World Cup': 'fifa.world',
  'Euros': 'uefa.euro',
  'Copa America': 'conmebol.america',
  'AFCON': 'caf.afcon'
};

const FD_LEAGUES = {
  'Premier League': 'PL',
  'La Liga': 'PD',
  'Bundesliga': 'BL1',
  'Serie A': 'SA',
  'Ligue 1': 'FL1',
  'Champions League': 'CL',
  'Europa League': 'EL',
  'Europa Conference League': 'UECL',
  'Euros': 'EC',
  'World Cup': 'WC',
  'Copa America': 'CLI',
  'Primeira Liga': 'PPL',
  'Eredivisie': 'DED',
  'Brasileirao': 'BSA',
  'Brasileirão': 'BSA'
};

const getCanonicalName = (rawName) => {
  if (!rawName) return '';

  return rawName.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const isStrongMatch = (dbName, apiName) => {
  const s1 = getCanonicalName(dbName);
  const s2 = getCanonicalName(apiName);

  if (s1.length < 3 || s2.length < 3) return s1 === s2;
  return s1.includes(s2) || s2.includes(s1);
};

const standingsCache = {};

async function getLeagueStandings(leagueName) {
  const mappedLeague = FD_LEAGUES[leagueName];

  if (mappedLeague && standingsCache[mappedLeague]) return standingsCache[mappedLeague];

  if (mappedLeague && process.env.FOOTBALL_DATA_API_KEY) {
    try {
      const liveRes = await fetch(`https://api.football-data.org/v4/competitions/${mappedLeague}/standings`, {
        headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
      });

      if (liveRes.ok) {
        const data = await liveRes.json();

        if (data.standings && data.standings[0]) {
          const resultStr = 'FULL LEAGUE TABLE: ' + data.standings[0].table.map((t) => `${t.position}. ${t.team.shortName} (${t.points}pts)`).join(', ');
          standingsCache[mappedLeague] = resultStr;
          return resultStr;
        }
      }
    } catch (e) {
      console.log(`⚠️ Live API failed for ${leagueName}, falling back to DB cache...`);
    }
  }

  try {
    if (mappedLeague) {
      const { data: dbStandings, error } = await supabase
        .from('standings')
        .select('position, team_short_name, team_name, points')
        .eq('league_code', mappedLeague)
        .order('position', { ascending: true });

      if (!error && dbStandings && dbStandings.length > 0) {
        const resultStr = 'FULL LEAGUE TABLE: ' + dbStandings.map((t) => `${t.position}. ${t.team_short_name || t.team_name} (${t.points}pts)`).join(', ');
        standingsCache[mappedLeague] = resultStr;
        return resultStr;
      }
    }
  } catch {}

  return 'TOURNAMENT PROFILE: Cup/Knockout or group-stage system active. Standings table not applicable. Focus context on single-match stakes and qualification.';
}

async function getGroupContextFromDb(leagueName) {
  const { data, error } = await supabase
    .from('matches')
    .select('home_team, away_team, home_score, away_score, status, match_group, stage')
    .eq('league', leagueName)
    .in('status', ['FT', 'FINISHED', 'AWARDED', 'AET', 'PEN'])
    .not('match_group', 'is', null)
    .limit(200);

  if (error || !data || data.length === 0) return '';

  const groups = {};

  data.forEach((m) => {
    const group = String(m.match_group || m.stage || 'Group').replace(/_/g, ' ');
    if (!groups[group]) groups[group] = {};

    [m.home_team, m.away_team].forEach((team) => {
      if (!groups[group][team]) groups[group][team] = { played: 0, points: 0, gd: 0 };