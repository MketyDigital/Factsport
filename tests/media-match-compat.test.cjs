const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('V2 Media match projection preserves legacy playback and live frontend fields separately from Prediction', () => {
  const migration = read('db/migrations/0017_factsport_media_match_metadata.sql');
  const reader = read('lib/adapters/postgres-matches.ts');
  const matchData = read('app/api/match-data/route.ts');
  const playback = read('app/api/match/[id]/playback/route.ts');
  const matchWidget = read('app/api/cache/match-widget/route.ts');
  const matchPin = read('app/api/match/pin/route.ts');

  for (const field of ['display_clock', 'clock_updated_at', 'provider_widget_id']) {
    assert.match(migration, new RegExp('ADD COLUMN IF NOT EXISTS ' + field));
  }
  for (const field of ['video_url', 'livestream_url', 'audio_url', 'media_url', 'stream_url', 'media_mode']) {
    assert.match(migration, new RegExp(field + ' text'));
  }
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.match_public_pins/i);
  assert.match(migration, /CREATE OR REPLACE VIEW public\.public_match_media/i);
  assert.match(migration, /rights_reviewed_by IS NOT NULL[\s\S]*usage_expires_at IS NULL OR usage_expires_at > now\(\)/i);
  assert.match(migration, /GRANT UPDATE \(display_clock, clock_updated_at\)[\s\S]*factsport_v2_espn_writer/i);
  assert.match(reader, /LEFT JOIN public\.public_match_media/);
  assert.match(reader, /LEFT JOIN public\.public_match_pins/);
  assert.match(reader, /display_clock/);
  assert.match(matchData, /getPostgresMatchById/);
  assert.match(matchData, /displayClock: match\.display_clock/);
  assert.match(playback, /getPostgresMatchById/);
  assert.match(playback, /safePlaybackUrl/);
  assert.match(matchWidget, /getPostgresMatchById/);
  assert.match(matchPin, /getPostgresMatchById/);
  assert.doesNotMatch(reader, /pro_analysis|prediction|settlement/i);
});
