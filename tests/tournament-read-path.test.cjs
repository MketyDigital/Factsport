const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const hub = read('app/tournaments/page.tsx');
const detail = read('app/tournaments/[league]/page.tsx');
const liveStandings = read('app/components/LiveStandings.tsx');
const matchesRoute = read('app/api/competitions/matches/route.ts');
const standingsRoute = read('app/api/cache/standings/route.ts');
const matchesAdapter = read('lib/adapters/postgres-matches.ts');

test('tournaments root is a directory rather than a route expecting a missing league parameter', () => {
  assert.ok(hub.includes('export default async function TournamentsPage'));
  assert.ok(hub.includes('listCurrentCompetitionDirectory'));
  assert.ok(hub.includes('encodeURIComponent(competition.name)'));
  assert.ok(!hub.includes('createClient'));
});

test('tournament detail uses the base PostgreSQL match reader when enabled', () => {
  assert.ok(detail.includes('listPostgresLeagueMatches'));
  assert.ok(detail.includes("FACTSPORT_MATCHES_BACKEND === 'postgres'"));
  assert.ok(matchesAdapter.includes('export async function listPostgresLeagueMatches'));
});

test('live standings obtains matches and standings from same-origin APIs without browser database access', () => {
  assert.ok(liveStandings.includes('/api/competitions/matches?league='));
  assert.ok(liveStandings.includes('/api/cache/standings?league='));
  assert.ok(!liveStandings.includes('createClient'));
  assert.ok(!liveStandings.includes('NEXT_PUBLIC_SUPABASE_URL'));
  assert.ok(liveStandings.includes('setInterval'));
});

test('competition endpoints expose bounded, narrow public projections', () => {
  assert.ok(matchesRoute.includes('listPostgresLeagueMatches'));
  assert.ok(matchesRoute.includes(".select('id, api_id, home_team"));
  assert.ok(standingsRoute.includes('listCurrentCompetitionStandings'));
  assert.ok(standingsRoute.includes("select('league_code, league_name, season"));
  assert.ok(!standingsRoute.includes(".select('*')"));
});
