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
  assert.match(claim, /readyProviders/);
  assert.match(claim, /mediaReadyProviders/);
  assert.match(claim, /c\.provider = ANY/);
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


test('social delivery adapter locks each attempt and uses direct Meta/Telegram plus the secure Logic Apps adapter', () => {
  const deliver = read('app/api/internal/social/deliver/route.ts');
  const result = read('app/api/internal/social/result/route.ts');
  const action = read('app/admin/social/actions.ts');
  const lockMigration = read('db/migrations/0036_factsport_social_provider_dispatch_lock.sql');
  assert.match(deliver, /provider_started_at/);
  assert.match(deliver, /graph\.facebook\.com/);
  assert.match(deliver, /Authorization: `Bearer \$\{token\}`/);
  assert.match(deliver, /api\.telegram\.org/);
  assert.match(deliver, /sendMediaGroup/);
  assert.match(deliver, /5 \* 1024 \* 1024/);
  assert.match(deliver, /FACTSPORT_LOGIC_APPS_SOCIAL_ADAPTER_URL/);
  assert.match(deliver, /Idempotency-Key/);
  assert.match(result, /!attempt\[0\]\.provider_started_at/);
  assert.match(action, /meta_multiple_images_not_supported/);
  assert.match(action, /Telegram image captions are limited to 1,024 characters/);
  assert.match(lockMigration, /provider_started_at timestamptz/);
  assert.match(lockMigration, /GRANT UPDATE \(provider_started_at\)/);
});


test('Logic Apps social scheduler template is disabled by default and uses sequential secure claim-deliver-result calls', () => {
  const template = JSON.parse(read('infra/azure/logic-app-social-dispatch-staging-disabled.json'));
  const workflow = template.resources[0].properties;
  const actions = workflow.definition.actions;
  assert.equal(template.parameters.enabled.defaultValue, false);
  assert.match(workflow.state, /Disabled/);
  assert.equal(actions.Recurrence, undefined);
  assert.equal(actions.Claim.type, 'Http');
  assert.equal(actions.For_each_job.type, 'Foreach');
  assert.equal(actions.For_each_job.operationOptions, 'Sequential');
  assert.equal(actions.For_each_job.actions.Deliver.type, 'Http');
  assert.equal(actions.For_each_job.actions.Record_result.type, 'Http');
  assert.deepEqual(actions.Claim.runtimeConfiguration.secureData.properties, ['inputs', 'outputs']);
  assert.deepEqual(actions.For_each_job.actions.Deliver.runtimeConfiguration.secureData.properties, ['inputs', 'outputs']);
  assert.deepEqual(actions.For_each_job.actions.Record_result.runtimeConfiguration.secureData.properties, ['inputs', 'outputs']);
  assert.match(actions.Claim.inputs.uri, /api\/internal\/social\/claim/);
  assert.match(actions.For_each_job.actions.Deliver.inputs.uri, /api\/internal\/social\/deliver/);
  assert.match(actions.For_each_job.actions.Record_result.inputs.uri, /api\/internal\/social\/result/);
});

test('provider readiness rejects query-string credentials on the Logic Apps adapter URL', () => {
  const client = read('lib/adapters/postgres-client.ts');
  assert.match(client, /!parsed\.search && !parsed\.hash/);
  assert.match(client, /FACTSPORT_LOGIC_APPS_SOCIAL_ADAPTER_TOKEN/);
});
