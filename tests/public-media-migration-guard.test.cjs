const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const migrationDir = path.join(root, 'db/migrations');
const readMigration = name => fs.readFileSync(path.join(migrationDir, name), 'utf8');

test('V2 migration inventory remains contiguous through the full V2 Media implementation chain', () => {
  const files = fs.readdirSync(migrationDir).filter(name => /^[0-9]{4}_/.test(name) && name.endsWith('.sql'));
  for (let number = 1; number <= 37; number += 1) {
    const prefix = String(number).padStart(4, '0');
    const matches = files.filter(name => name.slice(0, 5) === prefix + '_');
    assert.equal(matches.length, 1, 'expected exactly one migration for ' + prefix);
    assert.ok(fs.statSync(path.join(migrationDir, matches[0])).size > 0, matches[0] + ' must not be empty');
  }
  const prefixes = files.map(name => name.slice(0, 4));
  assert.equal(new Set(prefixes).size, prefixes.length, 'migration sequence numbers must be unique');
});

test('public homepage announcements expose only the Media-owned public projection', () => {
  const migration = readMigration('0024_factsport_media_public_announcements.sql');
  const grants = readMigration('0025_factsport_media_homepage_settings_grants.sql');

  assert.ok(migration.includes('ADD COLUMN IF NOT EXISTS announcement_text text'));
  assert.ok(migration.includes('announcement_text IS NULL OR char_length(announcement_text) <= 280'));
  assert.ok(migration.includes("announcement_link IS NULL OR announcement_link ~ '^https?://'"));
  assert.ok(migration.includes('CREATE OR REPLACE VIEW public.public_homepage_settings'));
  assert.ok(migration.includes('SELECT featured_match_id, announcement_text, announcement_link, announcement_enabled'));
  assert.ok(grants.includes('GRANT SELECT, INSERT, UPDATE ON public.homepage_settings TO factsport_v2_editorial_writer'));
  assert.ok(grants.includes('REVOKE ALL ON public.homepage_settings FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer, factsport_v2_espn_writer'));
});

test('public Media attestation enforcement fails closed and never rewrites existing records', () => {
  const migration = readMigration('0026_factsport_public_media_attestation_enforcement.sql');
  const executableLines = migration.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('--'));

  assert.ok(migration.includes('MEDIA_ATTESTATION_RECONCILIATION_REQUIRED'));
  assert.ok(migration.includes('EDITORIAL_ATTESTATION_RECONCILIATION_REQUIRED'));
  assert.ok(migration.includes('RAISE EXCEPTION'));
  assert.ok(migration.indexOf('DO $$') < migration.indexOf('VALIDATE CONSTRAINT'));
  assert.ok(migration.includes('VALIDATE CONSTRAINT media_social_publications_public_delivery_requires_confirmation'));
  assert.ok(migration.includes('ADD CONSTRAINT editorial_revision_published_requires_public_media_attestation'));
  assert.ok(!executableLines.some(line => /^(INSERT INTO|UPDATE|DELETE FROM|TRUNCATE|DROP TABLE)/i.test(line)));
  assert.equal(executableLines[0], 'BEGIN;');
  assert.equal(executableLines[executableLines.length - 1], 'COMMIT;');
});


test('public editorial sources view exposes references only for approved published articles', () => {
  const migration = readMigration('0033_factsport_public_editorial_sources.sql');
  assert.ok(migration.includes('public.public_editorial_article_sources'));
  assert.ok(migration.includes("a.status='published'"));
  assert.ok(migration.includes("a.review_status='approved'"));
  assert.ok(migration.includes('GRANT SELECT ON public.public_editorial_article_sources TO factsport_v2_reader'));
  assert.ok(!migration.includes('rights_reference'));
});


test('social channel admin migration grants only bounded settings updates and registers audit actions', () => {
  const migration = readMigration('0034_factsport_editorial_audit_and_social_channel_admin.sql');
  assert.ok(migration.includes("'source_added'"));
  assert.ok(migration.includes("'social_channel_configured'"));
  assert.ok(migration.includes("'media_detached'"));
  assert.ok(migration.includes('GRANT UPDATE (is_enabled, supports_media, settings, updated_at)'));
  assert.ok(!migration.includes('GRANT UPDATE ON public.media_social_channels'));
});


test('source provenance is scoped to the latest published editorial revision', () => {
  const migration = readMigration('0035_factsport_revision_scoped_editorial_sources.sql');
  assert.ok(migration.includes('ADD COLUMN IF NOT EXISTS revision_id uuid'));
  assert.ok(migration.includes("latest.workflow_status='published'"));
  assert.ok(migration.includes('latest.revision_number DESC'));
  assert.ok(migration.includes('s.revision_id'));
});


test('social provider delivery lock migration is included in the migration chain', () => {
  const migration = readMigration('0036_factsport_social_provider_dispatch_lock.sql');
  assert.ok(migration.includes('provider_started_at timestamptz'));
  assert.ok(migration.includes('GRANT UPDATE (provider_started_at)'));
});


test('social provider allowlist migration matches the implemented V2 adapter set', () => {
  const migration = readMigration('0037_factsport_social_provider_allowlist.sql');
  assert.ok(migration.includes("provider IN ('meta','telegram','buffer','make')"));
});


test('editorial writer media asset updates are column-scoped to rights and publication fields', () => {
  const migration = readMigration('0038_factsport_media_asset_column_grants.sql');
  assert.ok(migration.includes('REVOKE UPDATE ON public.media_assets FROM factsport_v2_editorial_writer'));
  assert.ok(migration.includes('GRANT UPDATE ('));
  for (const column of ['rights_status','rights_reference','attribution_text','alt_text','usage_expires_at','rights_reviewed_by','rights_reviewed_at','is_public','updated_at']) {
    assert.ok(migration.includes(column));
  }
  assert.ok(!migration.includes('GRANT UPDATE ON public.media_assets TO factsport_v2_editorial_writer'));
});
