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

test('standings page reads season-aware PostgreSQL tables and completed results when enabled', () => {
  assert.ok(page.includes("FACTSPORT_COMPETITIONS_BACKEND === 'postgres'"));
  assert.ok(page.includes('listCurrentCompetitionStandings'));
  assert.ok(page.includes('listPostgresLeagueResults'));
  assert.ok(page.includes('dbStandings[0].season'));
  assert.ok(page.indexOf('dbStandings = await listCurrentCompetitionStandings') < page.indexOf('dbMatches = await listPostgresLeagueResults'));
  assert.ok(page.includes('dbStandings[0].league_name'));
  assert.ok(matchesAdapter.includes('AND season ='));
  assert.ok(page.includes('serializeJsonLd(jsonLd)'));
});

test('league leaders use a same-origin API rather than a browser database client', () => {
  assert.ok(leaders.includes('/api/standings/leaders?league='));
  assert.ok(!leaders.includes('createClient'));
  assert.ok(!leaders.includes('tournament_scorers'));
});

test('leaders API returns an explicit public projection from PostgreSQL or a narrow legacy fallback', () => {
  assert.ok(route.includes('FACTSPORT_COMPETITIONS_BACKEND') && route.includes('listCurrentCompetitionPlayerLeaders'));
  assert.ok(route.includes('public, max-age=0, s-maxage=300'));
  assert.ok(route.includes("select('player_name, team_name, team_short_name, team_crest, goals, assists')"));
  assert.ok(!route.includes("select('*')"));
  assert.ok(homepageAdapter.includes('FROM public.public_competition_player_stats'));
});

test('recent form reader is bounded and uses only final scored match records', () => {
  assert.ok(matchesAdapter.includes('listPostgresLeagueResults'));
  assert.ok(matchesAdapter.includes("status IN ('FT', 'FINISHED', 'AET', 'PEN', 'AWARDED')"));
  assert.ok(matchesAdapter.includes('LIMIT'));
});
