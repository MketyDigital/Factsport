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
  assert.ok(auth.includes('WHERE issuer = ${identity!.issuer}'));
  assert.ok(auth.includes('AND subject = ${identity!.subject}'));
  assert.match(auth, /readFactsportEntraSession/);
  assert.ok(auth.includes('AND user_id = ${internalUserId!}::uuid'));
  assert.doesNotMatch(auth, /WHERE subject = \$\{authUser\.id\}/);
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
  assert.match(read('db/migrations/0021_factsport_editorial_review_feedback.sql'), /review_comment text/);
  assert.match(read('db/migrations/0021_factsport_editorial_review_feedback.sql'), /review_rejected/);
  assert.match(client, /approveEditorialRevision/);
  assert.match(client, /publishApprovedEditorial/);
  assert.match(client, /rejectEditorialRevision/);
  assert.doesNotMatch(client, /approveAndPublishEditorial/);
});

test('editorial and social mutations append audit events in their transaction', () => {
  assert.match(read('app/admin/social/actions.ts'), /idempotencyKey/);
  assert.match(read('app/admin/social/actions.ts'), /ON CONFLICT \(idempotency_key\) DO NOTHING/);
  assert.match(read('app/admin/social/SocialClient.tsx'), /crypto\.randomUUID\(\)/);
  for (const file of ['app/admin/news/actions.ts', 'app/admin/news/media-actions.ts', 'app/admin/social/actions.ts']) {
    assert.match(read(file), /media_editorial_audit_events/);
  }
});

test('Media admin shell does not expose legacy Prediction or broad user administration', () => {
  const layout = read('app/admin/layout.tsx');
  const home = read('app/admin/page.tsx');
  const matches = read('app/admin/matches/page.tsx');
  const users = read('app/admin/users/page.tsx');
  assert.match(layout, /authorizeMediaEditorialAction\('workspace'\)/);
  assert.doesNotMatch(layout, /ADMIN_EMAILS|VaultLock|getAuthenticatedAdmin|isAdminVaultUnlocked/);
  assert.doesNotMatch(home, /from ['\"].*(AdminCampaignManager|ApproveButton|ResetMonthButton|CleanupButton|PromoSettingsManager|GameRulesManager|AuditManager)/);
  assert.doesNotMatch(matches, /createClient|supabase|campaigns|pro_analysis/);
  assert.doesNotMatch(users, /SUPABASE_SERVICE_ROLE_KEY|select\('\*'\)|ADMIN_EMAILS/);
});


test('Entra External ID Media login uses discovery, PKCE, nonce, encrypted state and verified issuer-subject mapping', () => {
  const identity = read('lib/auth/entra-external.ts');
  const start = read('app/api/auth/entra/start/route.ts');
  const callback = read('app/api/auth/entra/callback/route.ts');
  const logout = read('app/api/auth/entra/logout/route.ts');
  const login = read('app/media-login/page.tsx');
  const authorization = read('app/lib/admin/v2-editorial-authorization.ts');
  const middleware = read('middleware.ts');
  assert.match(identity, /ENTRA_EXTERNAL_DISCOVERY_URL/);
  assert.match(identity, /ENTRA_EXTERNAL_ISSUER/);
  assert.match(identity, /ENTRA_EXTERNAL_CLIENT_ID/);
  assert.match(identity, /ENTRA_EXTERNAL_REDIRECT_URI/);
  assert.match(identity, /code_challenge_method: 'S256'/);
  assert.match(identity, /nonce/);
  assert.match(identity, /jwtDecrypt/);
  assert.match(identity, /createRemoteJWKSet/);
  assert.match(identity, /algorithms: \['RS256'\]/);
  assert.match(identity, /issuer: metadata\.issuer/);
  assert.match(identity, /audience: clientId/);
  assert.match(identity, /WHERE issuer = \$\{issuer\} AND subject = \$\{subject\}/);
  assert.match(identity, /FACTSPORT_AUTH_SESSION_SECRET/);
  assert.match(start, /createEntraAuthorization/);
  assert.match(callback, /completeEntraCallback/);
  assert.match(callback, /entraCookieNames\.session/);
  assert.match(logout, /maxAge: 0/);
  assert.match(login, /\/api\/auth\/entra\/start/);
  assert.match(authorization, /readFactsportEntraSession/);
  assert.doesNotMatch(authorization, /createClient\(|supabase\.auth/);
  assert.match(middleware, /hasEntraMediaSession/);
});


test('Media rights revocation is Media-admin-only, audited and retains the original object', () => {
  const authorization = read('app/lib/admin/v2-editorial-authorization.ts');
  const action = read('app/admin/news/media-actions.ts');
  const control = read('app/admin/media/MediaRightsRevocationControl.tsx');
  const page = read('app/admin/media/page.tsx');
  const migration = read('db/migrations/0040_factsport_media_rights_revocation.sql');
  assert.match(authorization, /rights_admin: \['media_admin'\]/);
  assert.match(action, /authorizeMediaEditorialAction\('rights_admin'\)/);
  assert.match(action, /rights_status='rejected', is_public=false/);
  assert.match(action, /media_rights_revoked/);
  assert.match(action, /reason/);
  assert.doesNotMatch(action, /bucket\.delete|factsportMediaBucket/);
  assert.match(control, /Confirm rights withdrawal/);
  assert.match(control, /revokeMediaRights/);
  assert.match(page, /roles\.includes\('media_admin'\)/);
  assert.match(migration, /media_rights_revoked/);
  assert.match(control, /must be removed separately at that provider/);
  assert.match(read('app/api/media/[...key]/route.ts'), /s-maxage=15/);
});
