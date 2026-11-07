const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(
  path.join(__dirname, '../db/migrations/0004_factsport_editorial_media.sql'),
  'utf8'
);

test('editorial articles preserve draft, review, publish and archive lifecycle', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.editorial_articles/i);
  assert.match(sql, /status IN \('draft', 'in_review', 'published', 'archived'\)/i);
  assert.match(sql, /published_at timestamptz/i);
  assert.match(sql, /editorial_articles_published_idx/i);
  assert.match(sql, /editorial_articles_headline_published_idx/i);
  assert.match(sql, /UNIQUE/i);
});

test('editorial revisions and source provenance are durable and attributable', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.editorial_article_revisions/i);
  assert.match(sql, /snapshot jsonb NOT NULL CHECK \(jsonb_typeof\(snapshot\) = 'object'\)/i);
  assert.match(sql, /UNIQUE \(article_id, revision_number\)/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.editorial_article_sources/i);
  assert.match(sql, /canonical_url text NOT NULL/i);
  assert.match(sql, /attribution_text text/i);
});

test('media publication requires an explicit rights state and scoped R2 object key', () => {
  assert.match(sql, /rights_status IN \('pending', 'owned', 'licensed', 'editorial_exception', 'rejected', 'expired'\)/i);
  assert.match(sql, /is_public boolean NOT NULL DEFAULT false/i);
  assert.match(sql, /NOT is_public OR rights_status IN \('owned', 'licensed', 'editorial_exception'\)/i);
  assert.match(sql, /object_key ~ '\^editorial\//i);
  assert.match(sql, /usage_expires_at/i);
});

test('public editorial view excludes unpublished content and unapproved or expired media', () => {
  assert.match(sql, /CREATE OR REPLACE VIEW public\.public_editorial_articles/i);
  assert.match(sql, /WHERE a\.status = 'published'[\s\S]*a\.published_at <= now\(\)/i);
  assert.match(sql, /m\.is_public = true/i);
  assert.match(sql, /m\.rights_status IN \('owned', 'licensed', 'editorial_exception'\)/i);
  assert.match(sql, /m\.usage_expires_at IS NULL OR m\.usage_expires_at > now\(\)/i);
});

test('public reader gets only the published view, not editorial write tables', () => {
  assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*FROM PUBLIC, factsport_v2_reader/i);
  assert.match(sql, /CREATE OR REPLACE VIEW public\.public_media_assets/i);
  assert.match(sql, /GRANT SELECT ON public\.public_editorial_articles, public\.public_media_assets[\s\S]*TO factsport_v2_reader/i);
  assert.doesNotMatch(sql, /\b(DROP|TRUNCATE)\b/i);
  assert.doesNotMatch(sql, /\bGRANT\s+(INSERT|UPDATE|DELETE)\b/i);
});
