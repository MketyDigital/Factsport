const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(
  path.join(__dirname, '../db/migrations/0003_factsport_public_predictions.sql'),
  'utf8'
);

test('public prediction schema supports anonymous visitors without email identity', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.prediction_participants/i);
  assert.match(sql, /visitor_token_hash char\(64\) NOT NULL UNIQUE/i);
  assert.match(sql, /visitor_token_hash ~ '\^\[0-9a-f\]\{64\}\$'/i);
  assert.doesNotMatch(sql, /email|email_verified|marketing_consent/i);
});

test('prediction rows enforce match ownership, allowed outcomes, score bounds and duplicate protection', () => {
  assert.match(sql, /REFERENCES public\.matches\(id\) ON DELETE RESTRICT/i);
  assert.match(sql, /predicted_outcome IN \('home', 'draw', 'away'\)/i);
  assert.match(sql, /prediction_participant_match_unique UNIQUE \(participant_id, match_id\)/i);
  assert.match(sql, /predictions_registered_user_match_unique/i);
  assert.match(sql, /predicted_home_score >= 0 AND predicted_away_score >= 0/i);
  assert.match(sql, /locked_at timestamptz NOT NULL/i);
});

test('anonymous predictions default to no prize eligibility and claim conflicts are auditable', () => {
  assert.match(sql, /is_eligible_for_prize boolean NOT NULL DEFAULT false/i);
  assert.match(sql, /prediction_participant_claims/i);
  assert.match(sql, /prediction_claim_conflicts/i);
  assert.match(sql, /anonymous_prediction_id/i);
  assert.match(sql, /existing_user_prediction_id/i);
});

test('new prediction tables are not directly exposed to public database roles', () => {
  assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*FROM PUBLIC/i);
  assert.doesNotMatch(sql, /\bGRANT\s+(SELECT|INSERT|UPDATE|DELETE)\b/i);
  assert.doesNotMatch(sql, /\b(DROP|TRUNCATE)\b/i);
});
