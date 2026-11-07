const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(
  path.join(__dirname, '../db/migrations/0005_factsport_editorial_provenance_review.sql'),
  'utf8'
);

test('editorial origin is explicit and never inferred from legacy author or slug', () => {
  assert.match(sql, /origin text NOT NULL DEFAULT 'unknown'/i);
  assert.match(sql, /origin IN \('manual', 'ai_assisted', 'automated', 'imported', 'unknown'\)/i);
  assert.match(sql, /legacy_body text/i);
  assert.match(sql, /legacy_content text/i);
  assert.match(sql, /original_created_at timestamptz/i);
});

test('publishing requires an identified human reviewer and approved review state', () => {
  assert.match(sql, /review_status text NOT NULL DEFAULT 'pending'/i);
  assert.match(sql, /reviewed_by uuid REFERENCES public\.app_users/i);
  assert.match(sql, /reviewed_at timestamptz/i);
  assert.match(sql, /review_status = 'approved'[\s\S]*reviewed_by IS NOT NULL[\s\S]*reviewed_at IS NOT NULL/i);
  assert.match(sql, /AND a\.review_status = 'approved'/i);
});

test('public editorial view includes SEO and provenance-safe publication metadata', () => {
  assert.match(sql, /a\.origin,/i);
  assert.match(sql, /a\.seo_title,/i);
  assert.match(sql, /a\.seo_description,/i);
  assert.match(sql, /a\.original_created_at,/i);
  assert.match(sql, /a\.last_verified_at/i);
});

test('media cannot become public until a rights review is recorded', () => {
  assert.match(sql, /rights_reviewed_by uuid REFERENCES public\.app_users/i);
  assert.match(sql, /rights_reviewed_at timestamptz/i);
  assert.ok(sql.includes('AND rights_reviewed_by IS NOT NULL'));
  assert.ok(sql.includes('AND rights_reviewed_at IS NOT NULL'));
  assert.match(sql, /NOT is_public[\s\S]*rights_status IN \('owned', 'licensed', 'editorial_exception'\)[\s\S]*rights_reviewed_at IS NOT NULL/i);
  assert.ok(sql.includes('AND m.rights_reviewed_by IS NOT NULL'));
  assert.ok(sql.includes('AND m.rights_reviewed_at IS NOT NULL'));
  assert.match(sql, /GRANT SELECT ON public\.public_editorial_articles, public\.public_media_assets[\s\S]*TO factsport_v2_reader/i);
});

test('migration is additive and does not import, delete or reset source content', () => {
  assert.doesNotMatch(sql, /\b(DROP TABLE|TRUNCATE|DELETE FROM|INSERT INTO)\b/i);
});
