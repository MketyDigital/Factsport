const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('live score projection reads previously-ingested rows without private or provider data', () => {
  const adapter = read('lib/adapters/postgres-matches.ts');
  const start = adapter.indexOf('export async function listPostgresLiveScoreSnapshot');
  assert.ok(start > 0);
  const coverageStart = adapter.indexOf('export async function listPostgresLiveCoverageWindow', start);
  assert.ok(coverageStart > start, 'score and playback projections must remain separate');
  const projection = adapter.slice(start, coverageStart);
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


test('Live Center loads rights-cleared video and audio separately from score refresh', () => {
  const adapter = read('lib/adapters/postgres-matches.ts');
  const page = read('app/live/page.tsx');
  const migration = read('db/migrations/0017_factsport_media_match_metadata.sql');
  const index = adapter.indexOf('export async function listPostgresLiveCoverageWindow');
  assert.ok(index > 0, 'separate coverage read model is required');
  const coverage = adapter.slice(index, adapter.indexOf('\nexport async function ', index + 30) > 0 ? adapter.indexOf('\nexport async function ', index + 30) : undefined);
  assert.match(coverage, /LEFT JOIN public\.public_match_media mm ON mm\.match_id = m\.id/);
  assert.match(coverage, /mm\.video_url, mm\.livestream_url, mm\.audio_url/);
  assert.match(coverage, /mm\.stream_url, mm\.media_mode/);
  assert.match(coverage, /Invalid live coverage window/);
  assert.doesNotMatch(coverage, /JOIN public\.match_media /);
  assert.match(page, /listPostgresLiveCoverageWindow\(\{ from: lookBack, to: lookForward \}\)/);
  assert.match(migration, /WHERE is_public = true/);
  assert.match(migration, /rights_reviewed_at IS NOT NULL/);
  assert.match(migration, /usage_expires_at IS NULL OR usage_expires_at > now\(\)/);
  const scoreStart = adapter.indexOf('export async function listPostgresLiveScoreSnapshot');
  const scoreEnd = adapter.indexOf('\n}\n', scoreStart) + 3;
  assert.ok(scoreStart >= 0 && scoreEnd > scoreStart && scoreEnd < index);
  const scoreProjection = adapter.slice(scoreStart, scoreEnd);
  assert.doesNotMatch(scoreProjection, /public_match_media|match_media|livestream_url|audio_url/);
});

test('database score snapshots are not the 3-second ESPN frontend or background live writer', () => {
  const handoff = read('docs/audit/handoffs/M20-FAST-EXTERNAL-LIVE-WORKER-AND-FRONTEND-DATA-PATH.md');
  const fetcher = read('app/utils/liveFetcher.ts');
  const provider = read('app/providers/MatchLiveProvider.tsx');
  const legacyLiveRoute = read('app/api/live/route.ts');
  assert.match(handoff, /NOT the fast frontend live-score API/);
  const originalFrontend = read('docs/audit/handoffs/M20-FAST-EXTERNAL-LIVE-WORKER-AND-FRONTEND-DATA-PATH.md');
  assert.match(originalFrontend, /live-api\.factsport\.com/);
  assert.doesNotMatch(fetcher, /live-api\.factsport\.com/);
  assert.match(fetcher, /NEXT_PUBLIC_FACTSPORT_FAST_LIVE_BACKEND/);
  assert.match(provider, /pollInterval = isLive \? 3000 : 60000/);
  assert.match(legacyLiveRoute, /legacyRouteDisabled/);
});
