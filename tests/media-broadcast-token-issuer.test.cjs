const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('broadcast token issuer is same-origin, room-scoped and derives every identity/role server-side', () => {
  const route = read('app/api/studio/token/route.ts');
  const adapter = read('lib/adapters/postgres-client.ts');
  const client = read('app/providers/GlobalMediaProvider.tsx');
  const room = read('app/components/FactSportMediaRoom.tsx');
  assert.match(route, /export async function POST/);
  assert.match(route, /request\.headers\.get\('origin'\) !== requestUrl\.origin/);
  assert.match(route, /roomKey/);
  assert.match(route, /inviteToken/);
  assert.match(route, /public\.media_broadcast_room_roles/);
  assert.match(route, /public\.media_broadcast_invites/);
  assert.match(route, /revoked_at/);
  assert.match(route, /max_uses/);
  assert.match(route, /use_count=use_count\+1/);
  assert.match(route, /createCall: grant === 'host'/);
  assert.match(route, /user_id: identity\.userId/);
  assert.match(route, /TOKEN_TTL_SECONDS = 4 \* 60 \* 60/);
  assert.match(route, /__Host-factsport_broadcast_anon/);
  assert.match(route, /media_broadcast_token_rate_limits/);
  assert.match(route, /guest_admitted/);
  assert.doesNotMatch(route, /ADMIN_EMAILS|NEXT_PUBLIC_STREAM_API_KEY|user_metadata|body\.role|body\.userId/);
  assert.match(adapter, /FACTSPORT_BROADCAST_TOKEN_HYPERDRIVE/);
  assert.match(adapter, /STREAM_API_SECRET/);
  assert.match(adapter, /FACTSPORT_BROADCAST_TOKEN_ISSUER_READY/);
  assert.match(client, /\/api\/studio\/token/);
  assert.match(client, /window\.location\.hash/);
  assert.match(client, /data\.roomName/);
  assert.doesNotMatch(client, /\/api\/stream\/token/);
  assert.match(room, /createBroadcastInviteForRoomKey/);
  assert.doesNotMatch(room, /\/api\/stream\/token/);
});

test('broadcast token rate limits store keyed hashes only and are isolated to token issuer', () => {
  const migration = read('db/migrations/0029_factsport_broadcast_token_rate_limits.sql');
  const route = read('app/api/studio/token/route.ts');
  assert.match(migration, /bucket_hash char\(64\)/);
  assert.match(migration, /GRANT SELECT, INSERT, UPDATE ON public\.media_broadcast_token_rate_limits/);
  assert.match(route, /SHA-256/);
  assert.match(route, /cf-connecting-ip/);
  assert.match(route, /consumeRateLimit\(tx, ipBucketHash, 30\)/);
  assert.match(route, /inviteRateHash, 6/);
  assert.match(route, /userRateHash, 12/);
  assert.doesNotMatch(migration, /ip_address|invite_token text|raw_token/);
});


test('broadcast caller UI follows server call-in eligibility and separates host from moderator controls', () => {
  const provider = read('app/providers/GlobalMediaProvider.tsx');
  const room = read('app/components/FactSportMediaRoom.tsx');
  assert.match(provider, /setCanRequestCallIn\(data\.canRequestCallIn === true\)/);
  assert.match(provider, /canRequestCallIn,/);
  assert.match(room, /canRequestCallIn \? \(/);
  assert.match(room, /assigned caller role/);
  assert.doesNotMatch(room, /href="\/login"/);
  assert.match(room, /role === 'moderator'/);
  assert.match(room, /role === 'admin' \? \(!isLive/);
  assert.match(room, /role === 'admin' && <button onClick=\{toggleRecording\}/);
});
