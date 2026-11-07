const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Media editorial authorization is domain-owned and capability-specific', () => {
  const migration = read('db/migrations/0020_factsport_media_editorial_rbac.sql');
  const auth = read('app/lib/admin/v2-editorial-authorization.ts');
  assert.match(migration, /media_editorial_memberships/);
  assert.match(migration, /'writer', 'editor', 'publisher', 'social_manager', 'media_admin'/);
  assert.match(migration, /media_editorial_audit_events/);
  assert.match(migration, /GRANT SELECT ON public\.media_editorial_memberships\s+TO factsport_v2_editorial_writer/);
  assert.match(auth, /external_identities/);
  assert.match(auth, /media_editorial_memberships/);
  assert.match(auth, /writer/);
  assert.match(auth, /publisher/);
  assert.match(auth, /social_manager/);
  assert.doesNotMatch(auth, /ADMIN_EMAILS|profiles|user_metadata/);
});

test('CMS approval and publication require distinct author, reviewer and publisher identities', () => {
  const actions = read('app/admin/news/actions.ts');
  const client = read('app/admin/news/NewsroomClient.tsx');
  assert.match(actions, /authorizeMediaEditorialAction\('draft'\)/);
  assert.match(actions, /authorizeMediaEditorialAction\('review'\)/);
  assert.match(actions, /authorizeMediaEditorialAction\('publish'\)/);
  assert.match(actions, /workflow_status='approved'/);
  assert.match(actions, /revision\.reviewed_by === actorId/);
  assert.match(actions, /revision\.changed_by === actorId/);
  assert.match(actions, /'review_approved'/);
  assert.match(actions, /'published'/);
  assert.match(actions, /rejectEditorialRevision/);
  assert.match(actions, /review_comment/);
  assert.match(client, /approveEditorialRevision/);
  assert.match(client, /publishApprovedEditorial/);
  assert.match(client, /rejectEditorialRevision/);
  assert.doesNotMatch(client, /approveAndPublishEditorial/);
});

test('editorial and social mutations append audit events in their transaction', () => {
  assert.match(read('app/admin/social/actions.ts'), /idempotencyKey/);
  assert.match(read('app/admin/social/actions.ts'), /ON CONFLICT \(idempotency_key\) DO NOTHING/);
  for (const file of ['app/admin/news/actions.ts', 'app/admin/news/media-actions.ts', 'app/admin/social/actions.ts']) {
    assert.match(read(file), /media_editorial_audit_events/);
  }
});

test('Media admin shell does not expose legacy Prediction or broad user administration', () => {
  const layout = read('app/admin/layout.tsx');
  const home = read('app/admin/page.tsx');
  const matches = read('app/admin/matches/page.tsx');
  const users = read('app/admin/users/page.tsx');
  assert.match(layout, /authorizeMediaEditorialAction\('read'\)/);
  assert.doesNotMatch(layout, /ADMIN_EMAILS|VaultLock|getAuthenticatedAdmin|isAdminVaultUnlocked/);
  assert.doesNotMatch(home, /from ['\"].*(AdminCampaignManager|ApproveButton|ResetMonthButton|CleanupButton|PromoSettingsManager|GameRulesManager|AuditManager)/);
  assert.doesNotMatch(matches, /createClient|supabase|campaigns|pro_analysis/);
  assert.doesNotMatch(users, /SUPABASE_SERVICE_ROLE_KEY|select\('\*'\)|ADMIN_EMAILS/);
});
