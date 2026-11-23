const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Media match detail, live data, widget, pins and playback have explicit PostgreSQL cutover gates', () => {
  const paths = [
    'app/api/match/[id]/route.ts',
    'app/api/match-data/route.ts',
    'app/api/match/[id]/playback/route.ts',
    'app/api/cache/match-widget/route.ts',
    'app/api/match/pin/route.ts',
  ];
  for (const path of paths) {
    const source = read(path);
    assert.match(source, /FACTSPORT_MATCH_DETAIL_BACKEND/);
    assert.match(source, /cloudflare:workers/);
    assert.match(source, /status: 503/);
    assert.doesNotMatch(source, /supabase|createClient|\.from\(/i);
  }
  assert.match(read('app/api/match/[id]/playback/route.ts'), /getPostgresMatchPlaybackById/);
  assert.match(read('lib/adapters/postgres-matches.ts'), /export async function getPostgresMatchPlaybackById/);
});

test('V2 competition APIs use PostgreSQL only and fail closed when not provisioned', () => {
  for (const path of [
    'app/api/competitions/matches/route.ts',
    'app/api/cache/standings/route.ts',
    'app/api/standings/leaders/route.ts',
    'app/api/cache/leaders/route.ts',
  ]) {
    const source = read(path);
    assert.match(source, /FACTSPORT_COMPETITIONS_BACKEND|FACTSPORT_MATCHES_BACKEND/);
    assert.match(source, /!== 'postgres'/);
    assert.match(source, /status: 503/);
    assert.doesNotMatch(source, /supabase|createClient|\.from\(/i);
  }
  assert.match(read('app/api/cache/leaders/route.ts'), /listCurrentCompetitionPlayerLeaders/);
  assert.match(read('app/api/cache/standings/route.ts'), /listCurrentCompetitionStandings/);
});

test('Prediction analysis remains a separate fail-closed route, not folded into Media match detail', () => {
  const analysis = read('app/api/match/[id]/analysis/route.ts');
  const mediaReader = read('lib/adapters/postgres-matches.ts');
  assert.match(analysis, /V2 Prediction analysis reader is not provisioned/);
  assert.match(analysis, /FACTSPORT_ENVIRONMENT !== 'development'/);
  assert.doesNotMatch(mediaReader, /pro_analysis|campaign_id|affiliate_link|settlement/i);
});


test('only the migration-verified PostgreSQL match-detail reader is enabled in Cloudflare staging', () => {
  const config = read('cloudflare.config.ts');
  assert.match(config, /FACTSPORT_MATCH_DETAIL_BACKEND: bindings\.text\("postgres"\)/);
  assert.match(config, /FACTSPORT_EDITORIAL_BACKEND: bindings\.text\("postgres"\)/);
  assert.match(config, /FACTSPORT_COMPETITIONS_BACKEND: bindings\.text\("disabled"\)/);
  assert.match(config, /FACTSPORT_HOMEPAGE_BACKEND: bindings\.text\("postgres"\)/);
  assert.match(config, /FACTSPORT_PREDICTION_SETTINGS_BACKEND: bindings\.text\("disabled"\)/);
});


test('protected staging preflight verifies every grant needed by PostgreSQL match detail', () => {
  const preflight = read('app/api/v2/staging/db-preflight/route.ts');
  for (const column of ['legacy_match_id', 'display_clock', 'provider_widget_id']) {
    assert.match(preflight, new RegExp(`has_column_privilege\\('factsport_v2_reader', 'public\\.matches', '${column}', 'SELECT'\\)`));
  }
  for (const view of ['public_match_pins', 'public_match_media']) {
    assert.match(preflight, new RegExp(`has_table_privilege\\('factsport_v2_reader', 'public\\.${view}', 'SELECT'\\)`));
  }
  assert.match(preflight, /getPostgresMatchById/);
  assert.match(preflight, /getPostgresMatchPlaybackById/);
  assert.match(preflight, /getPostgresTeamForm/);
  assert.match(preflight, /getExternalData/);
  const workflow = read('.github/workflows/v2-app-staging.yml');
  assert.match(workflow, /\.matchDetailReader\.ready == true and \.matchDetailRuntimeProbe\.ready == true/);
  assert.match(workflow, /DB_PREFLIGHT_READY=false[\s\S]*for attempt in 1 2 3 4 5/);
  assert.match(workflow, /Authorized staging database preflight \$attempt/);
  assert.match(workflow, /DB_PREFLIGHT_READY/);
});

test('public Media match API strips Prediction output and bounds team-form reads to recent matches', () => {
  const matchApi = read('app/api/match/[id]/route.ts');
  assert.match(matchApi, /delete publicMediaData\.predictor/);
  assert.match(matchApi, /NextResponse\.json\(publicMediaData/);
  const matches = read('lib/adapters/postgres-matches.ts');
  assert.match(matches, /match_date >= now\(\) - interval '2 years'/);
  assert.match(matches, /home_team = \$\{canonicalTeamName\}/);
  assert.match(matches, /away_team = \$\{canonicalTeamName\}/);
  assert.match(matches, /ORDER BY match_date DESC LIMIT 30/);
});

test('successful Hyperdrive reads survive client cleanup errors', () => {
  const client = read('lib/adapters/postgres-client.ts');
  assert.match(client, /result = await operation\(sql\)/);
  assert.match(client, /catch \{ \/\* Hyperdrive owns pooled connection recovery \*\/ \}/);
  assert.match(client, /return result;/);
});


test('staging preflight inventories competition grants and freshness without returning rows', () => {
  const preflight = read('app/api/v2/staging/db-preflight/route.ts');
  assert.match(preflight, /competitionReadModel/);
  assert.match(preflight, /public\.public_competition_standings/);
  assert.match(preflight, /public\.public_competition_player_stats/);
  assert.match(preflight, /current_standings_rows/);
  assert.match(preflight, /current_player_stats_rows/);
  assert.match(preflight, /standings_updated_at/);
  assert.match(preflight, /player_stats_updated_at/);
  assert.match(read('.github/workflows/v2-app-staging.yml'), /\.competitionReadModel\.ready == true/);
});
