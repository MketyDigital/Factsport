const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const migrationDir = path.join(root, 'db/migrations');
const readMigration = name => fs.readFileSync(path.join(migrationDir, name), 'utf8');

test('V2 migration inventory remains contiguous through the public Media policy boundary', () => {
  const files = fs.readdirSync(migrationDir).filter(name => /^\\d{4}_.+\\.sql$/.test(name));
  for (let number = 1; number <= 26; number += 1) {
    const prefix = String(number).padStart(4, '0');
    const matches = files.filter(name => name.startsWith(prefix + '_'));
    assert.equal(matches.length, 1, `expected exactly one migration for ${prefix}`);
    assert.ok(fs.statSync(path.join(migrationDir, matches[0])).size > 0, `${matches[0]} must not be empty`);
  }
  const prefixes = files.map(name => name.slice(0, 4));
  assert.equal(new Set(prefixes).size, prefixes.length, 'migration sequence numbers must be unique');
});

test('public homepage announcements expose only the Media-owned public projection', () => {
  const migration = readMigration('0024_factsport_media_public_announcements.sql');
  const grants = readMigration('0025_factsport_media_homepage_settings_grants.sql');

  assert.match(migration, /ADD COLUMN IF NOT EXISTS announcement_text text/);
  assert.match(migration, /announcement_text IS NULL OR char_length\\(announcement_text\\) <= 280/);
  assert.match(migration, /announcement_link IS NULL OR announcement_link ~ '\\^https\\?:\\/\\/'/);
  assert.match(migration, /CREATE OR REPLACE VIEW public\\.public_homepage_settings/);
  assert.match(migration, /SELECT featured_match_id, announcement_text, announcement_link, announcement_enabled/);
  assert.match(grants, /GRANT SELECT, INSERT, UPDATE ON public\\.homepage_settings TO factsport_v2_editorial_writer/);
  assert.match(grants, /REVOKE ALL ON public\\.homepage_settings FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer, factsport_v2_espn_writer/);
});

test('public Media attestation enforcement fails closed and never rewrites existing records', () => {
  const migration = readMigration('0026_factsport_public_media_attestation_enforcement.sql');

  assert.match(migration, /MEDIA_ATTESTATION_RECONCILIATION_REQUIRED/);
  assert.match(migration, /EDITORIAL_ATTESTATION_RECONCILIATION_REQUIRED/);
  assert.match(migration, /RAISE EXCEPTION/);
  assert.ok(migration.indexOf('DO $$') < migration.indexOf('VALIDATE CONSTRAINT'));
  assert.match(migration, /VALIDATE CONSTRAINT media_social_publications_public_delivery_requires_confirmation/);
  assert.match(migration, /ADD CONSTRAINT editorial_revision_published_requires_public_media_attestation/);
  assert.doesNotMatch(migration, /^\\s*(INSERT INTO|UPDATE|DELETE FROM|TRUNCATE|DROP TABLE)\\b/im);
  assert.match(migration, /^BEGIN;/);
  assert.match(migration, /COMMIT;\\s*$/);
});
