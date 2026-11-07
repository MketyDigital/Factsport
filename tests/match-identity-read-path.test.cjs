const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const migration = read('db/migrations/0008_factsport_match_identity_alias.sql');
const adapter = read('lib/adapters/postgres-matches.ts');
const route = read('app/api/match/[id]/route.ts');

test('legacy match identity is an additive alias; V2 primary IDs remain canonical', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS legacy_match_id uuid/i);
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS matches_legacy_match_id_uidx/i);
  assert.match(migration, /WHERE legacy_match_id IS NOT NULL/i);
  assert.doesNotMatch(migration, /DROP COLUMN|UPDATE public\.matches\s+SET\s+id\s*=/i);
  assert.match(adapter, /WHERE id = \$\{matchId\}::uuid OR legacy_match_id = \$\{matchId\}::uuid/);
  assert.match(adapter, /ORDER BY CASE WHEN id = \$\{matchId\}::uuid THEN 0 ELSE 1 END/);
});

test('PostgreSQL match detail response is a safe public projection', () => {
  const start = adapter.indexOf('export async function getPostgresMatchById');
  const end = adapter.indexOf('export async function getPostgresMatchPlaybackById', start);
  const reader = adapter.slice(start, end > start ? end : undefined);
  assert.ok(start >= 0);
  assert.match(reader, /SELECT m\.id, m\.api_id, m\.espn_id, m\.league/);
  for (const privateField of ['video_url', 'livestream_url', 'audio_url', 'pro_analysis', 'campaign_id', 'affiliate_link', 'points_distributed']) {
    assert.equal(reader.includes(privateField), false, privateField);
  }
});

test('match detail PostgreSQL backend remains independently opt-in and staging-private', () => {
  assert.match(route, /FACTSPORT_MATCH_DETAIL_BACKEND/);
  assert.match(route, /getPostgresMatchById\(params\.id\)/);
  assert.match(route, /private, no-store, max-age=0/);
  assert.match(route, /const supabase = createClient/);
});
