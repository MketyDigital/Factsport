const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('social claim endpoint is fail-closed and uses the dedicated dispatcher database identity', () => {
  const auth = read('app/api/internal/social/_auth.ts');
  const claim = read('app/api/internal/social/claim/route.ts');
  const client = read('lib/adapters/postgres-client.ts');
  assert.match(auth, /FACTSPORT_SOCIAL_DISPATCH_READY !== 'true'/);
  assert.match(auth, /FACTSPORT_SOCIAL_DISPATCHER_HYPERDRIVE/);
  assert.match(auth, /FACTSPORT_SOCIAL_DISPATCH_TOKEN/);
  assert.match(auth, /crypto\.subtle\.digest\('SHA-256'/);
  assert.match(client, /withFactsportSocialDispatcherPostgres/);
  assert.match(claim, /FOR UPDATE OF o, p SKIP LOCKED/);
  assert.match(claim, /status='processing'/);
  assert.match(claim, /status='publishing'/);
  assert.match(claim, /lease_expires_at/);
  assert.match(claim, /public\.public_social_media_assets/);
  assert.match(claim, /unknown_result/);
  assert.match(claim, /c\.settings->>'page_id'/);
  assert.match(claim, /c\.settings->'chat_ids'/);
  assert.doesNotMatch(claim, /c\.settings AS|channelSettings/);
});

test('social result callback records provider receipts, bounded retries and unknown outcomes without blind retry', () => {
  const result = read('app/api/internal/social/result/route.ts');
  assert.match(result, /isSocialDispatcherRequestAuthorized/);
  assert.match(result, /outcome: 'succeeded' \| 'retryable_failure' \| 'permanent_failure' \| 'unknown_result'/);
  assert.match(result, /status='published'/);
  assert.match(result, /status='retry'/);
  assert.match(result, /status='dead_letter'/);
  assert.match(result, /input\.outcome === 'unknown_result'/);
  assert.match(result, /MAX_ATTEMPTS = 6/);
  assert.match(result, /make_interval\(secs =>/);
  assert.match(result, /lease_owner/);
  assert.match(result, /provider_response/);
});

test('dispatcher migration exposes only published rights-cleared media and permits scoped attempt receipt updates', () => {
  const migration = read('db/migrations/0032_factsport_social_dispatcher_media_and_receipts.sql');
  assert.match(migration, /CREATE OR REPLACE VIEW public\.public_social_media_assets/);
  assert.match(migration, /rights_reviewed_by IS NOT NULL/);
  assert.match(migration, /a\.status='published'/);
  assert.match(migration, /usage_expires_at IS NULL OR m\.usage_expires_at > now\(\)/);
  assert.match(migration, /GRANT SELECT ON public\.public_social_media_assets TO factsport_v2_social_dispatcher/);
  assert.match(migration, /unknown_result/);
  assert.ok(migration.includes('GRANT UPDATE (') && migration.includes('finished_at\n) ON public.media_social_delivery_attempts'));
});
