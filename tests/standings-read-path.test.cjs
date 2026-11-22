const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const page = read('app/standings/page.tsx');
const leaders = read('app/components/LeagueLeaders.tsx');
const route = read('app/api/standings/leaders/route.ts');
const homepageAdapter = read('lib/adapters/postgres-homepage.ts');
const matchesAdapter = read('lib/adapters/postgres-matches.ts');

test('standings page reads current PostgreSQL rows and provider-sourced form when enabled', () => {
  assert.ok(page.includes("FACTSPORT_COMPETITIONS_BACKEND !== 'postgres'"));
  assert.ok(!page.toLowerCase().includes('supabase'));
  const leagueMap = page.slice(page.indexOf('const LEAGUE_MAP'), page.indexOf('};', page.indexOf('const LEAGUE_MAP')));
  assert.doesNotMatch(leagueMap, /Champions League|World Cup|Euros|Copa America|AFCON/);
  assert.ok(page.includes('listCurrentCompetitionStandings'));
  assert.ok(page.includes('entry.form'));
  assert.ok(page.includes("['W', 'D', 'L']"));
  assert.ok(!page.includes('listPostgresLeagueResults'));
  assert.ok(page.includes('serializeJsonLd(jsonLd)'));
  assert.ok(homepageAdapter.includes('form'));
});

test('league leaders use a same-origin API rather than a browser database client', () => {
  assert.ok(leaders.includes('/api/standings/leaders?league='));
  assert.ok(!leaders.includes('createClient'));
  assert.ok(!leaders.includes('tournament_scorers'));
});

test('leaders API returns an explicit public projection from the PostgreSQL V2 reader only', () => {
  assert.ok(route.includes('FACTSPORT_COMPETITIONS_BACKEND') && route.includes('listCurrentCompetitionPlayerLeaders'));
  assert.ok(!route.toLowerCase().includes('supabase'));
  assert.ok(route.includes("new Set(['PL', 'PD', 'BL1', 'SA', 'FL1'])"));
  assert.ok(route.includes('public, max-age=0, s-maxage=300'));
  assert.ok(route.includes('listCurrentCompetitionPlayerLeaders(league, stat, 5)'));
  assert.ok(route.includes('row.player_name'));
  assert.ok(!route.includes("select('*')"));
  assert.ok(!route.includes('tournament_scorers'));
  assert.ok(homepageAdapter.includes('FROM public.public_competition_player_stats'));
});

test('recent form reader is bounded and uses only final scored match records', () => {
  assert.ok(matchesAdapter.includes('listPostgresLeagueResults'));
  assert.ok(matchesAdapter.includes("status IN ('FT', 'FINISHED', 'AET', 'PEN', 'AWARDED')"));
  assert.ok(matchesAdapter.includes('LIMIT'));
});
