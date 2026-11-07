const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(
  path.join(__dirname, '../db/migrations/0006_factsport_homepage_sports_read_models.sql'),
  'utf8'
);

test('homepage featured matches are a safe projection over canonical matches', () => {
  assert.match(sql, /ADD COLUMN IF NOT EXISTS is_featured boolean/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS season text/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS featured_rank integer/i);
  assert.match(sql, /CREATE OR REPLACE VIEW public\.public_featured_matches/i);
  assert.equal(sql.split('BEGIN;').length - 1, 1);
  assert.equal(sql.split('COMMIT;').length - 1, 1);
  assert.ok(sql.includes('is_featured, featured_rank,'));
  assert.ok(sql.includes('season text'));
  assert.match(sql, /WHERE is_featured = true/i);
  assert.doesNotMatch(sql, /points_distributed/i);
});

test('homepage settings expose only the featured match pointer', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.homepage_settings/i);
  assert.match(sql, /featured_match_id uuid REFERENCES public\.matches/i);
  assert.match(sql, /CREATE OR REPLACE VIEW public\.public_homepage_settings AS\s+SELECT featured_match_id/i);
  assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*public\.homepage_settings[\s\S]*FROM PUBLIC, factsport_v2_reader/i);
});

test('competition standings are season/group aware and deterministic', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.competition_standings/i);
  assert.match(sql, /season text NOT NULL/i);
  assert.match(sql, /match_group text NOT NULL/i);
  assert.match(sql, /UNIQUE \(league_code, season, match_group, team_id\)/i);
  assert.match(sql, /competition_one_current_season_idx/i);
  assert.match(sql, /position integer NOT NULL/i);
  assert.match(sql, /CREATE OR REPLACE VIEW public\.public_competition_standings/i);
});

test('public highlights require reviewed rights and allow only approved video hosts', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.match_highlights/i);
  assert.match(sql, /rights_reviewed_by uuid REFERENCES public\.app_users/i);
  assert.match(sql, /rights_reviewed_at IS NOT NULL/i);
  assert.match(sql, /rights_status IN \('owned', 'licensed', 'editorial_exception'\)/i);
  assert.ok(sql.includes('youtube-nocookie\\.com/embed'));
  assert.ok(sql.includes('player\\.vimeo\\.com/video'));
  assert.match(sql, /CREATE OR REPLACE VIEW public\.public_match_highlights/i);
  assert.match(sql, /thumbnail_media_key/i);
  assert.match(sql, /m\.match_date, m\.home_score, m\.away_score/i);
  assert.match(sql, /match_highlight_provider_url/i);
  assert.match(sql, /match_highlight_provider_embed/i);
});

test('all new public read models are SELECT-only for the application reader', () => {
  assert.match(sql, /REVOKE ALL ON[\s\S]*public\.match_highlights[\s\S]*FROM PUBLIC, factsport_v2_reader/i);
  assert.match(sql, /GRANT SELECT ON[\s\S]*public\.public_match_highlights[\s\S]*TO factsport_v2_reader/i);
  assert.doesNotMatch(sql, /\b(DROP TABLE|TRUNCATE|DELETE FROM|INSERT INTO)\b/i);
});
