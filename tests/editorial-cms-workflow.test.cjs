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
const publicAdapter = read('lib/adapters/postgres-editorial.ts');
const newsListing = read('app/news/page.tsx');
const newsArticle = read('app/news/[slug]/page.tsx');
const actions = read('app/admin/news/actions.ts');
const socialActions = read('app/admin/social/actions.ts');
const page = read('app/admin/news/page.tsx');
const adapter = read('lib/adapters/postgres-client.ts');
const ui = read('app/admin/news/NewsroomClient.tsx');

test('social publishing is a separate durable Media workflow', () => {
  assert.match(socialSql, /CREATE TABLE IF NOT EXISTS public\.media_social_channels/i);
  assert.match(socialSql, /CREATE TABLE IF NOT EXISTS public\.media_social_publications/i);
  assert.match(socialSql, /CREATE TABLE IF NOT EXISTS public\.media_social_delivery_attempts/i);
  assert.match(socialSql, /CREATE TABLE IF NOT EXISTS public\.media_social_outbox/i);
  assert.match(socialSql, /idempotency_key text NOT NULL UNIQUE/i);
  assert.match(socialSql, /lease_expires_at timestamptz/i);
  assert.match(socialSql, /UNIQUE \(publication_id, attempt_number\)/i);
  assert.match(socialSql, /REVOKE ALL ON public\.media_social_channels[\s\S]*factsport_v2_reader/i);
  assert.doesNotMatch(socialSql, /DROP TABLE|TRUNCATE|DELETE FROM/i);
});

test('editorial writer privileges are isolated from public and sports runtimes', () => {
  assert.match(grantsSql, /factsport_v2_editorial_writer/i);
  assert.match(grantsSql, /GRANT SELECT, INSERT, UPDATE ON public\.editorial_articles/i);
  assert.match(grantsSql, /GRANT SELECT, INSERT ON public\.editorial_article_revisions/i);
  assert.match(grantsSql, /GRANT INSERT ON public\.media_social_outbox/i);
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
  assert.ok(actions.includes('A different administrator must review and approve the revision.'));
  assert.ok(actions.includes('reviewed_by'));
  assert.ok(actions.includes('reviewed_at'));
  assert.ok(ui.includes('Save draft'));
  assert.ok(ui.includes('Submit for review'));
  assert.ok(ui.includes('Approve & publish'));
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
  assert.match(socialActions, /unique Factsport domain identity mapping/i);
});
