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
    assert.match(source, /FACTSPORT_ENVIRONMENT !== 'development'/);
    assert.match(source, /status: 503/);
  }
  assert.match(read('app/api/match/[id]/playback/route.ts'), /getPostgresMatchPlaybackById/);
  assert.match(read('lib/adapters/postgres-matches.ts'), /export async function getPostgresMatchPlaybackById/);
});

test('competition standings and player leaders do not silently fall back to legacy Supabase in staging', () => {
  for (const path of [
    'app/api/competitions/matches/route.ts',
    'app/api/cache/standings/route.ts',
    'app/api/standings/leaders/route.ts',
    'app/api/cache/leaders/route.ts',
  ]) {
    const source = read(path);
    assert.match(source, /FACTSPORT_COMPETITIONS_BACKEND|FACTSPORT_MATCHES_BACKEND/);
    assert.match(source, /FACTSPORT_ENVIRONMENT !== 'development'/);
    assert.match(source, /status: 503/);
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
  assert.match(config, /FACTSPORT_HOMEPAGE_BACKEND: bindings\.text\("disabled"\)/);
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
  assert.match(read('.github/workflows/v2-app-staging.yml'), /\.matchDetailReader\.ready == true and \.matchDetailRuntimeProbe\.ready == true/);
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
