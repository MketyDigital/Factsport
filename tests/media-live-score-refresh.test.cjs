const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('live score projection reads previously-ingested rows without private or provider data', () => {
  const adapter = read('lib/adapters/postgres-matches.ts');
  const start = adapter.indexOf('export async function listPostgresLiveScoreSnapshot');
  assert.ok(start > 0);
  const projection = adapter.slice(start);
  assert.match(projection, /withFactsportPostgres\(sql => sql`/);
  assert.match(projection, /FROM public\.matches/);
  assert.match(projection, /home_score, away_score/);
  assert.match(projection, /source_updated_at/);
  assert.match(projection, /LIMIT 1500/);
  assert.doesNotMatch(projection, /INSERT INTO|UPDATE public|DELETE FROM|service_role|premium|predictor|livestream_url/);
});

test('live refresh API is backend gated, read only, and has bounded edge cache', () => {
  const route = read('app/api/media/live-scores/route.ts');
  assert.match(route, /FACTSPORT_MATCHES_BACKEND/);
  assert.match(route, /!== 'postgres'/);
  assert.match(route, /listPostgresLiveScoreSnapshot\(\)/);
  assert.match(route, /s-maxage=10, stale-while-revalidate=5/);
  assert.match(route, /private, no-store, max-age=0/);
  assert.match(route, /status: 503/);
  assert.doesNotMatch(route, /export async function POST|service_role|DATABASE_URL|supabase/);
});

test('live client refresh preserves coverage URLs, respects tab visibility and remains local-day correct', () => {
  const client = read('app/components/LiveMediaClient.tsx');
  assert.match(client, /fetch\('\/api\/media\/live-scores'/);
  assert.match(client, /setInterval\(\(\) => \{ void refresh\(\); \}, 15000\)/);
  assert.match(client, /document\.hidden \|\| inFlight/);
  assert.match(client, /controller\.abort\(\)/);
  assert.match(client, /clearInterval\(interval\)/);
  assert.match(client, /document\.removeEventListener\('visibilitychange', refresh\)/);
  assert.match(client, /\{ \.\.\.previous, status: update\.status, home_score: update\.home_score/);
  assert.match(client, /const \[liveMatches, setLiveMatches\]/);
  assert.match(client, /liveMatches\.forEach/);
  assert.match(client, /new Date\(now\.getFullYear\(\), now\.getMonth\(\), now\.getDate\(\)/);
  assert.match(client, /!isFinished && \(isLiveNow \|\| isToday\)/);
  assert.match(client, /m\.livestream_url \|\| m\.audio_url/);
  const mergeStart = client.indexOf('const previous = existing.get(id);');
  const mergeEnd = client.indexOf('return Array.from(existing.values())', mergeStart);
  assert.ok(mergeStart > 0 && mergeEnd > mergeStart);
  const merge = client.slice(mergeStart, mergeEnd);
  assert.doesNotMatch(merge, /livestream_url:|audio_url:|video_url:|rights_reference:/);
});
