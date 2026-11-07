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
    assert.match(source, /FACTSPORT_ENVIRONMENT === 'staging'/);
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
    assert.match(source, /FACTSPORT_ENVIRONMENT === 'staging'/);
    assert.match(source, /status: 503/);
  }
  assert.match(read('app/api/cache/leaders/route.ts'), /listCurrentCompetitionPlayerLeaders/);
  assert.match(read('app/api/cache/standings/route.ts'), /listCurrentCompetitionStandings/);
});

test('Prediction analysis remains a separate fail-closed route, not folded into Media match detail', () => {
  const analysis = read('app/api/match/[id]/analysis/route.ts');
  const mediaReader = read('lib/adapters/postgres-matches.ts');
  assert.match(analysis, /V2 Prediction analysis reader is not provisioned/);
  assert.match(analysis, /FACTSPORT_ENVIRONMENT === 'staging'/);
  assert.doesNotMatch(mediaReader, /pro_analysis|campaign_id|affiliate_link|settlement/i);
});


test('unprovisioned V2 backends stay explicitly disabled in Cloudflare staging config', () => {
  const config = read('cloudflare.config.ts');
  assert.match(config, /FACTSPORT_MATCH_DETAIL_BACKEND: bindings\.text\("disabled"\)/);
  assert.match(config, /FACTSPORT_COMPETITIONS_BACKEND: bindings\.text\("disabled"\)/);
  assert.match(config, /FACTSPORT_HOMEPAGE_BACKEND: bindings\.text\("disabled"\)/);
  assert.match(config, /FACTSPORT_PREDICTION_SETTINGS_BACKEND: bindings\.text\("disabled"\)/);
});
