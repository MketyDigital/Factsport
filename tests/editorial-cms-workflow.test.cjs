const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const socialSql = read('db/migrations/0009_factsport_media_social_publishing.sql');
const grantsSql = read('db/migrations/0010_factsport_editorial_writer_grants.sql');
const revisionSql = read('db/migrations/0011_factsport_editorial_revision_workflow.sql');
const legacyMediaSql = read('db/migrations/0012_factsport_editorial_legacy_media_mapping.sql');
const teamMediaGrants = read('db/migrations/0013_factsport_editorial_team_media_grants.sql');
const revisionMediaSql = read('db/migrations/0014_factsport_revision_scoped_media.sql');
const socialAutomationSql = read('db/migrations/0015_factsport_social_event_automation.sql');
const socialOutboxSql = read('db/migrations/0016_factsport_media_social_event_outbox.sql');
const socialRoute = read('app/api/social/route.ts');
const archivedSocialRoute = read('docs/audit/legacy-source/api-social-route-v1.ts.txt');
const publicAdapter = read('lib/adapters/postgres-editorial.ts');
const newsListing = read('app/news/page.tsx');
const newsArticle = read('app/news/[slug]/page.tsx');
const actions = read('app/admin/news/actions.ts');
const socialActions = read('app/admin/social/actions.ts');
const page = read('app/admin/news/page.tsx');
const adapter = read('lib/adapters/postgres-client.ts');
const ui = read('app/admin/news/NewsroomClient.tsx');
const mediaUpload = read('app/api/admin/media/route.ts');
const mediaActions = read('app/admin/news/media-actions.ts');

test('social publishing is a separate durable Media workflow', () => {
  assert.match(socialSql, /CREATE TABLE IF NOT EXISTS public\.media_social_channels/i);
  assert.match(socialSql, /CREATE TABLE IF NOT EXISTS public\.media_social_publications/i);
  assert.match(socialSql, /CREATE TABLE IF NOT EXISTS public\.media_social_delivery_attempts/i);
  assert.match(socialSql, /CREATE TABLE IF NOT EXISTS public\.media_social_outbox/i);
  assert.match(socialSql, /idempotency_key text NOT NULL UNIQUE/i);
  assert.match(socialSql, /settings::text !~\* '"\(access_token\|refresh_token\|token\|secret\|password\|api_key\)"'/i);
  assert.match(socialSql, /lease_expires_at timestamptz/i);
  assert.match(socialSql, /UNIQUE \(publication_id, attempt_number\)/i);
  assert.match(socialSql, /REVOKE ALL ON public\.media_social_channels[\s\S]*factsport_v2_reader/i);
  assert.doesNotMatch(socialSql, /DROP TABLE|TRUNCATE|DELETE FROM/i);
});

test('editorial writer privileges are isolated from public and sports runtimes', () => {
  assert.match(grantsSql, /factsport_v2_editorial_writer/i);
  assert.match(grantsSql, /GRANT SELECT, INSERT, UPDATE ON public\.editorial_articles/i);
  assert.match(grantsSql, /GRANT SELECT, INSERT, UPDATE ON public\.editorial_article_revisions/i);
  assert.match(grantsSql, /GRANT SELECT, INSERT, UPDATE ON public\.media_social_outbox/i);
  assert.match(grantsSql, /factsport_v2_reader, factsport_v2_schedule_writer, factsport_v2_espn_writer/i);
  assert.doesNotMatch(grantsSql, /GRANT .* ON public\.matches/i);
  assert.doesNotMatch(grantsSql, /GRANT .* ON public\.predictions/i);
  assert.doesNotMatch(grantsSql, /GRANT .*DELETE|GRANT .*TRUNCATE/i);
});

test('CMS write path uses a dedicated Hyperdrive binding and no Supabase fallback', () => {
  assert.match(adapter, /FACTSPORT_EDITORIAL_HYPERDRIVE/);
  assert.match(adapter, /There is deliberately no DATABASE_URL or Supabase service-role fallback/i);
  assert.ok(actions.includes('withFactsportEditorialPostgres'));
  assert.ok(page.includes('withFactsportEditorialPostgres'));
  assert.ok(!actions.includes('getSupabaseAdmin'));
  assert.ok(!page.includes('getSupabaseAdmin'));
});

test('editorial lifecycle requires review before publication and records revisions', () => {
  assert.ok(actions.includes("status='draft'"));
  assert.ok(actions.includes("status='in_review'"));
  assert.ok(actions.includes("status='published'"));
  assert.ok(actions.includes('editorial_article_revisions'));
  assert.ok(actions.includes('A different authorized editor must review the revision.'));
  assert.ok(actions.includes('workflow_status=\'approved\''));
  assert.ok(actions.includes('publishApprovedEditorial'));
  assert.ok(actions.includes('reviewed_by'));
  assert.ok(actions.includes('reviewed_at'));
  assert.ok(ui.includes('Save draft'));
  assert.ok(ui.includes('Submit for review'));
  assert.ok(ui.includes('Approve revision'));
  assert.ok(ui.includes('Publish approved'));
});

test('CMS does not publish social content as articles or merge Prediction responsibilities', () => {
  assert.ok(ui.includes('Media content'));
  assert.ok(!actions.includes('prediction'));
  assert.ok(!actions.includes('settlement'));
  assert.ok(!actions.includes('winner'));
});


test('published article changes are versioned and reviewed without replacing live copy early', () => {
  assert.match(revisionSql, /workflow_status IN \('draft', 'in_review', 'approved', 'published', 'rejected', 'superseded'\)/i);
  assert.match(revisionSql, /submitted_by uuid REFERENCES public\.app_users/i);
  assert.match(revisionSql, /reviewed_by uuid REFERENCES public\.app_users/i);
  assert.match(actions, /Published content is immutable until its replacement revision is approved/i);
  assert.match(actions, /workflow_status='superseded'/i);
  assert.match(actions, /workflow_status='in_review'/i);
  assert.match(actions, /workflow_status='published'/i);
  assert.match(page, /FROM public\.editorial_article_revisions/i);
});


test('legacy match-story team names and logos map to rights-cleared V2 media assets', () => {
  assert.match(legacyMediaSql, /team_1_name text/i);
  assert.match(legacyMediaSql, /team_2_name text/i);
  assert.match(legacyMediaSql, /legacy_media_references jsonb/i);
  assert.match(legacyMediaSql, /CREATE TABLE IF NOT EXISTS public\.editorial_article_team_media/i);
  assert.match(legacyMediaSql, /team_side IN \('team_1', 'team_2'\)/i);
  assert.match(legacyMediaSql, /rights_reviewed_by IS NOT NULL/i);
  assert.match(teamMediaGrants, /factsport_v2_editorial_writer/i);
  assert.match(publicAdapter, /team_1_logo_key, team_2_logo_key/i);
  assert.match(newsListing, /row\.team_1_logo_key/);
  assert.match(newsArticle, /article\.team_1_logo_key/);
});


test('social scheduling is attributed and cancellation cannot race an active delivery', () => {
  assert.match(socialActions, /idempotency_key, created_by, updated_by/i);
  assert.match(socialActions, /media_social_outbox/i);
  assert.match(socialActions, /FOR UPDATE/i);
  assert.match(socialActions, /already being delivered or has completed/i);
  assert.match(socialActions, /authorizeMediaEditorialAction\('social'\)/);
  assert.match(socialActions, /authorization\.user\.domainUserId/);
});


test('editorial media uploads are private, validated, hashed and rights-reviewed before attachment', () => {
  assert.match(mediaUpload, /MAX_BYTES = 8 \* 1024 \* 1024/i);
  assert.match(mediaUpload, /image\/jpeg.*image\/png.*image\/webp/i);
  assert.match(mediaUpload, /validImageSignature/i);
  assert.match(mediaUpload, /SHA-256/i);
  assert.match(mediaUpload, /factsportMediaBucket/);
  assert.match(mediaUpload, /rights_status, is_public, uploaded_by/i);
  assert.match(mediaUpload, /'pending', false/i);
  assert.match(mediaUpload, /isSameOriginRequest/);
  assert.match(mediaActions, /rights_reviewed_by/);
  assert.match(mediaActions, /rights_reviewed_at/);
  assert.match(mediaActions, /workflow_status='draft'/);
  assert.match(mediaActions, /editorial_article_revision_media/);
  assert.doesNotMatch(mediaActions, /is_public=false/);
  assert.match(actions, /editorial_article_revision_media/);
  assert.match(actions, /is_public=true/);
  assert.match(revisionMediaSql, /CREATE TABLE IF NOT EXISTS public\.editorial_article_revision_media/i);
  assert.match(revisionMediaSql, /public_media_assets[\s\S]*EXISTS \([\s\S]*editorial_articles/i);
  assert.match(revisionMediaSql, /GRANT SELECT, INSERT, UPDATE ON public\.editorial_article_revision_media/i);
  assert.match(ui, /Approve rights & attach/);
});


test('legacy match-event social behaviour is preserved as V2 policy but cannot invoke legacy Supabase sender', () => {
  assert.match(socialAutomationSql, /fallback_first_match_when_no_vip_today boolean NOT NULL DEFAULT true/i);
  assert.match(socialAutomationSql, /images_enabled boolean NOT NULL DEFAULT false/i);
  assert.match(socialAutomationSql, /Premier League/);
  assert.match(socialAutomationSql, /Nigeria/);
  assert.match(socialAutomationSql, /'lineups'.*'buf_x1'.*true/s);
  assert.match(socialAutomationSql, /'goals'.*'fb1'.*true/s);
  assert.match(socialAutomationSql, /'fulltime'.*'make1'.*true/s);
  assert.match(socialAutomationSql, /INSERT INTO public\.media_social_channels[\s\S]*false\)/i);
  assert.match(socialAutomationSql, /REVOKE ALL ON public\.media_social_automation_settings/i);
  assert.match(socialRoute, /status: 410/);
  assert.match(socialRoute, /V2_SOCIAL_DISPATCHER_NOT_PROVISIONED/);
  assert.doesNotMatch(socialRoute, /createClient|SUPABASE_SERVICE_ROLE_KEY|BUFFER_ACCESS_TOKEN/);
  assert.match(archivedSocialRoute, /SAFETY_MAP/);
  assert.match(archivedSocialRoute, /normalizeLineupsEventConfig/);
  assert.match(archivedSocialRoute, /parseTemplate/);
  assert.match(archivedSocialRoute, /postToBufferWithRetry/);
  assert.match(archivedSocialRoute, /postToFbWithRetry/);
  assert.match(archivedSocialRoute, /postToMakeWithRetry/);
  assert.match(archivedSocialRoute, /telegram_bot_token/);
  assert.match(archivedSocialRoute, /TEMPORARY: images disabled for all outgoing posts/);
});


test('match-event fan-out has a durable Media outbox and a separate provider dispatcher identity', () => {
  assert.match(socialOutboxSql, /CREATE TABLE IF NOT EXISTS public\.media_social_match_events/i);
  assert.match(socialOutboxSql, /dedupe_key text NOT NULL UNIQUE/i);
  assert.match(socialOutboxSql, /UNIQUE \(match_id, event_key\)/i);
  assert.match(socialOutboxSql, /CREATE TABLE IF NOT EXISTS public\.media_social_match_deliveries/i);
  assert.match(socialOutboxSql, /UNIQUE \(event_id, channel_id\)/i);
  assert.match(socialOutboxSql, /lease_expires_at timestamptz/i);
  assert.match(socialOutboxSql, /CREATE TABLE IF NOT EXISTS public\.media_social_match_delivery_attempts/i);
  assert.match(socialOutboxSql, /factsport_v2_media_automation_writer/i);
  assert.match(socialOutboxSql, /factsport_v2_social_dispatcher/i);
  assert.match(socialOutboxSql, /GRANT SELECT ON public\.matches/i);
  assert.match(socialOutboxSql, /factsport_v2_editorial_writer/i);
  assert.doesNotMatch(socialOutboxSql, /GRANT .* ON public\.predictions/i);
  assert.doesNotMatch(socialOutboxSql, /GRANT .* ON public\.settlement/i);
});


test('public Media publisher attestations are enforced and legacy rows are reconciled before validation', () => {
  const enforcement = read('db/migrations/0026_factsport_public_media_attestation_enforcement.sql');
  assert.match(enforcement, /MEDIA_ATTESTATION_RECONCILIATION_REQUIRED/);
  assert.match(enforcement, /EDITORIAL_ATTESTATION_RECONCILIATION_REQUIRED/);
  assert.match(enforcement, /VALIDATE CONSTRAINT media_social_publications_public_delivery_requires_confirmation/);
  assert.match(enforcement, /editorial_revision_published_requires_public_media_attestation/);
  assert.match(enforcement, /VALIDATE CONSTRAINT editorial_revision_published_requires_public_media_attestation/);
  assert.doesNotMatch(enforcement, /UPDATE public\.media_social_publications|UPDATE public\.editorial_article_revisions/);
});


test('editorial asset previews require Media authorization and remain private and no-store', () => {
  const preview = read('app/api/admin/media/[id]/route.ts');
  const newsroom = read('app/admin/news/NewsroomClient.tsx');
  assert.match(preview, /authorizeMediaEditorialAction\('media'\)/);
  assert.match(preview, /FACTSPORT_EDITORIAL_HYPERDRIVE|withFactsportEditorialPostgres/);
  assert.match(preview, /factsportMediaBucket\(\)\.get/);
  assert.match(preview, /private, no-store/);
  assert.match(preview, /X-Content-Type-Options/);
  assert.match(preview, /PREVIEW_TYPES/);
  assert.match(newsroom, /\/api\/admin\/media\//);
  assert.doesNotMatch(preview, /public, max-age|public_media_assets/);
});


test('Media library is role-protected, paginated and exposes only private asset metadata', () => {
  const route = read('app/api/admin/media/route.ts');
  const page = read('app/admin/media/page.tsx');
  const client = read('app/admin/media/MediaLibraryClient.tsx');
  const layout = read('app/admin/layout.tsx');
  assert.match(route, /export async function GET/);
  assert.match(route, /authorizeMediaEditorialAction\('media'\)/);
  assert.match(route, /LIMIT \$\{limit \+ 1\} OFFSET \$\{offset\}/);
  assert.match(route, /Cache-Control': 'private, no-store/);
  assert.match(page, /authorizeMediaEditorialAction\('media'\)/);
  assert.match(client, /\/api\/admin\/media\?/);
  assert.match(client, /Load more assets/);
  assert.match(client, /rights_reference/);
  assert.match(layout, /href="\/admin\/media"/);
  assert.doesNotMatch(route, /public_media_assets|SUPABASE_SERVICE_ROLE_KEY/);
});


test('editorial composer preview reuses the exact sanitized public Markdown renderer', () => {
  const client = read('app/admin/news/NewsroomClient.tsx');
  const renderer = read('app/components/MarkdownRenderer.tsx');
  assert.match(client, /import MarkdownRenderer from '@\/app\/components\/MarkdownRenderer'/);
  assert.match(client, /Preview uses the same sanitized Markdown renderer/);
  assert.match(client, /<MarkdownRenderer content=\{form\.bodyMarkdown\} \/>/);
  assert.match(client, /Not published/);
  assert.match(renderer, /rehypeSanitize/);
  assert.match(renderer, /rehypeSafeEmbeds/);
});


test('editorial composer can reuse only rights-approved, non-expired media assets', () => {
  const client = read('app/admin/news/NewsroomClient.tsx');
  const api = read('app/api/admin/media/route.ts');
  assert.match(client, /Reuse an existing approved asset/);
  assert.match(client, /rights_status\) &&/);
  assert.match(client, /owned', 'licensed', 'editorial_exception/);
  assert.match(client, /usage_expires_at/);
  assert.match(client, /setUploadedAsset\(\{ id: asset\.id/);
  assert.match(client, /reviewRightsAndAttachMedia/);
  assert.match(api, /authorizeMediaEditorialAction\('media'\)/);
});


test('reusing an approved asset in a new revision does not unpublish its existing public attachment', () => {
  const mediaActions = read('app/admin/news/media-actions.ts');
  assert.match(mediaActions, /INSERT INTO public\.editorial_article_revision_media/);
  assert.doesNotMatch(mediaActions, /is_public=false/);
});


test('revision-scoped inline media is ordered, rights-filtered and projected only on published articles', () => {
  const migration = read('db/migrations/0027_factsport_revision_inline_media_gallery.sql');
  const mediaActions = read('app/admin/news/media-actions.ts');
  const publish = read('app/admin/news/actions.ts');
  const adapter = read('lib/adapters/postgres-editorial.ts');
  const article = read('app/news/[slug]/page.tsx');
  assert.match(migration, /placement IN \('hero', 'team_1', 'team_2', 'inline'\)/);
  assert.match(migration, /PRIMARY KEY \(revision_id, placement, position\)/);
  assert.match(migration, /public_editorial_article_inline_media/);
  assert.match(migration, /a\.status = 'published'/);
  assert.match(migration, /m\.rights_status IN \('owned', 'licensed', 'editorial_exception'\)/);
  assert.match(mediaActions, /ON CONFLICT \(revision_id, placement, position\)/);
  assert.match(publish, /attachment\.placement === 'inline'/);
  assert.match(publish, /placement='inline' AND position=/);
  assert.match(adapter, /public_editorial_article_inline_media/);
  assert.match(article, /article\.inline_media/);
  assert.match(article, /\/api\/media\//);
});

test('public article pages do not carry Prediction prize acquisition promotions', () => {
  const article = read('app/news/[slug]/page.tsx');
  assert.match(article, /Follow fixtures, live scores and match coverage/);
  assert.doesNotMatch(article, /Win Amazing Prizes|Start Predicting|Think You.*Know Football/);
});


test('editorial revision history is role-protected and restore creates a new draft without rewriting live publication', () => {
  const route = read('app/api/admin/news/[id]/revisions/route.ts');
  const actions = read('app/admin/news/actions.ts');
  const client = read('app/admin/news/NewsroomClient.tsx');
  assert.match(route, /authorizeMediaEditorialAction\('read'\)/);
  assert.match(route, /ORDER BY revision_number DESC/);
  assert.match(route, /LIMIT 50/);
  assert.match(route, /private, no-store/);
  assert.match(actions, /export async function restoreEditorialRevision/);
  assert.match(actions, /Restored from revision #/);
  assert.match(actions, /INSERT INTO public\.editorial_article_revision_media/);
  assert.match(actions, /workflow_status='draft'/);
  assert.match(actions, /if \(articles\[0\]\.status !== 'published'\)/);
  assert.match(client, /Revision history/);
  assert.match(client, /Restore as new draft/);
  assert.match(client, /live published article has not been changed/);
});


test('draft saves carry forward the previous draft revision media attachments', () => {
  assert.match(actions, /let previousRevisionId: string \| null = null/);
  assert.match(actions, /workflow_status IN \('draft','in_review','approved'\)[\s\S]*ORDER BY revision_number DESC LIMIT 1 FOR UPDATE/);
  assert.match(actions, /INSERT INTO public\.editorial_article_revision_media[\s\S]*SELECT \$\{newRevision\[0\]\.id\}::uuid, placement, position, media_id, remove_media, now\(\)/);
  assert.match(actions, /WHERE revision_id=\$\{previousRevisionId\}::uuid/);
});

test('newsroom lists current revision media and allows audited removal from a draft', () => {
  const newsroomPage = read('app/admin/news/page.tsx');
  assert.match(newsroomPage, /COALESCE\(revision_media\.items, '\[\]'::jsonb\) AS revision_media/);
  assert.match(newsroomPage, /LEFT JOIN LATERAL \([\s\S]*editorial_article_revision_media/);
  assert.match(ui, /Attached to this draft revision/);
  assert.match(ui, /Remove from draft/);
  assert.match(ui, /removeRevisionMedia/);
  assert.match(mediaActions, /export async function removeRevisionMedia/);
  assert.match(mediaActions, /media_id, remove_media, updated_at/);
  assert.match(mediaActions, /media_detached/);
  assert.match(mediaActions, /remove_media=true/);
});


test('editorial uploads persist intrinsic dimensions and reject oversized image canvases', () => {
  assert.match(mediaUpload, /function imageDimensions/);
  assert.match(mediaUpload, /getUint32\(16, false\)/);
  assert.match(mediaUpload, /frameMarkers/);
  assert.match(mediaUpload, /VP8X/);
  assert.match(mediaUpload, /VP8L/);
  assert.match(mediaUpload, /width > 16000 \|\| height > 16000 \|\| width \* height > 40000000/);
  assert.match(mediaUpload, /\$\{dimensions\.width\}, \$\{dimensions\.height\}/);
  assert.match(mediaUpload, /width, height, alt_text/);
});


test('editing a published article seeds its current hero, team logos and inline gallery into the new revision', () => {
  assert.match(actions, /else if \(currentStatus === 'published'\)/);
  assert.match(actions, /FROM public\.editorial_article_media[\s\S]*placement='hero'/);
  assert.match(actions, /placement='inline'/);
  assert.match(actions, /FROM public\.editorial_article_team_media/);
  assert.match(actions, /SELECT \$\{newRevision\[0\]\.id\}::uuid, team_side, 0, media_id, false, now\(\)/);
});


test('editorial upload rejects oversized request bodies before multipart parsing', () => {
  assert.match(mediaUpload, /content-length/);
  assert.match(mediaUpload, /MAX_BYTES \+ 64 \* 1024/);
  assert.match(mediaUpload, /status: 413/);
  assert.match(mediaUpload, /request\.formData\(\)/);
});
