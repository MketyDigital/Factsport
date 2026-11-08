const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('V2 studio admin uses dedicated Media broadcast authorization and database binding only', () => {
  const actions = read('app/admin/studio/actions.ts');
  const page = read('app/admin/studio/page.tsx');
  const client = read('app/admin/studio/StudioClient.tsx');
  const authorization = read('app/lib/admin/v2-editorial-authorization.ts');
  const adapter = read('lib/adapters/postgres-client.ts');
  for (const source of [actions, page, client]) {
    assert.doesNotMatch(source, /getSupabaseAdmin|createClient|global_studio|ADMIN_EMAILS|user_metadata/);
  }
  assert.match(actions, /authorizeMediaEditorialAction\('broadcast'\)/);
  assert.match(actions, /withFactsportBroadcastAdminPostgres/);
  assert.match(actions, /token_hash/);
  assert.match(actions, /SHA-256/);
  assert.match(actions, /createMatchBroadcastRoom/);
  assert.match(actions, /scope_type, match_id/);
  assert.match(actions, /is_active, public_listening_enabled, callin_enabled/);
  assert.match(actions, /invite_created/);
  assert.match(actions, /invite_revoked/);
  assert.match(actions, /role_granted/);
  assert.match(actions, /role_revoked/);
  assert.match(actions, /Stream token issuer is not provisioned/);
  assert.match(page, /authorizeMediaEditorialAction\('broadcast'\)/);
  assert.match(page, /media_broadcast_invites/);
  assert.match(page, /media_broadcast_room_roles/);
  assert.match(client, /Create match-specific room/);
  assert.match(client, /Create invitation token/);
  assert.match(client, /Guest redemption is not enabled/);
  assert.match(client, /disabled/);
  assert.match(authorization, /broadcast: \['media_admin'\]/);
  assert.match(adapter, /FACTSPORT_BROADCAST_ADMIN_HYPERDRIVE/);
});

test('broadcast role grants retain revoked history and audit all administrative changes', () => {
  const migration = read('db/migrations/0028_factsport_broadcast_admin_audit_and_role_history.sql');
  assert.match(migration, /DROP CONSTRAINT IF EXISTS media_broadcast_room_roles_room_id_user_id_role_key_key/);
  assert.match(migration, /WHERE revoked_at IS NULL/);
  assert.match(migration, /'settings_updated'/);
  assert.match(migration, /'role_granted', 'role_revoked'/);
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE|DELETE FROM/);
});


test('broadcast admin exposes webhook-backed participants and can revoke their room access', () => {
  const page = read('app/admin/studio/page.tsx');
  const client = read('app/admin/studio/StudioClient.tsx');
  const actions = read('app/admin/studio/actions.ts');
  const migration = read('db/migrations/0030_factsport_broadcast_token_identity_and_webhooks.sql');
  assert.match(page, /media_broadcast_participants/);
  assert.match(page, /WHERE p\.left_at IS NULL/);
  assert.match(client, /Live participants/);
  assert.match(client, /Block participant/);
  assert.match(actions, /blockBroadcastParticipant/);
  assert.match(actions, /UPDATE public\.media_broadcast_token_identities SET revoked_at/);
  assert.match(actions, /blockRevokedStreamUsers/);
  assert.match(migration, /GRANT UPDATE \(left_at, last_seen_at, mic_enabled, role_key\)/);
});


test('broadcast role changes reconcile Stream call membership and preserve fail-closed revocation', () => {
  const actions = read('app/admin/studio/actions.ts');
  const client = read('app/admin/studio/StudioClient.tsx');
  assert.match(actions, /setStreamCallMemberRole/);
  assert.match(actions, /unblockStreamCallUser/);
  assert.match(actions, /update_members: \[\{ user_id: userId, role \}\]/);
  assert.match(actions, /blockedUserIds/);
  assert.match(actions, /UPDATE public\.media_broadcast_token_identities SET revoked_at=now\(\)/);
  assert.match(actions, /role_revoked/);
  assert.match(client, /result\.data\?\.warning/);
});
