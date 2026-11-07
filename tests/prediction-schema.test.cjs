const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(
  path.join(__dirname, '../db/migrations/0003_factsport_public_predictions.sql'),
  'utf8'
);

test('public prediction participants provide email contact without creating an account', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.prediction_contacts/i);
  assert.match(sql, /email_address text NOT NULL/i);
  assert.match(sql, /email_normalized text NOT NULL UNIQUE/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.prediction_participants/i);
  assert.match(sql, /visitor_token_hash char\(64\) NOT NULL UNIQUE/i);
  assert.match(sql, /contact_id uuid NOT NULL UNIQUE/i);
  assert.doesNotMatch(sql, /email_verified_at[^,\n]*NOT NULL/i);
  assert.doesNotMatch(sql, /CREATE TABLE IF NOT EXISTS public\.app_users/i);
});

test('marketing is a distinct optional opt-in and preserves consent evidence', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.marketing_subscriptions/i);
  assert.match(sql, /status text NOT NULL DEFAULT 'pending_confirmation'/i);
  assert.match(sql, /purpose = 'factsport_updates_and_offers'/i);
  assert.match(sql, /consent_version text NOT NULL/i);
  assert.match(sql, /consent_text text NOT NULL/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.marketing_consent_events/i);
  assert.match(sql, /event_type IN \('opt_in', 'confirmation', 'withdrawal'\)/i);
  assert.match(sql, /UNIQUE \(contact_id, channel, purpose\)/i);
});

test('prediction rows enforce valid outcomes, score bounds, match ownership and duplicate protection', () => {
  assert.match(sql, /REFERENCES public\.matches\(id\) ON DELETE RESTRICT/i);
  assert.match(sql, /predicted_outcome IN \('home', 'draw', 'away'\)/i);
  assert.match(sql, /prediction_participant_match_unique UNIQUE \(participant_id, match_id\)/i);
  assert.match(sql, /predictions_registered_user_match_unique/i);
  assert.match(sql, /predicted_home_score IS NOT NULL AND predicted_away_score IS NOT NULL/i);
  assert.match(sql, /predicted_home_score >= 0 AND predicted_away_score >= 0/i);
  assert.match(sql, /locked_at timestamptz NOT NULL/i);
});

test('anonymous predictions default to prize-ineligible and claim conflicts are auditable', () => {
  assert.match(sql, /is_eligible_for_prize boolean NOT NULL DEFAULT false/i);
  assert.match(sql, /prediction_participant_claims/i);
  assert.match(sql, /prediction_claim_conflicts/i);
  assert.match(sql, /anonymous_prediction_id/i);
  assert.match(sql, /existing_user_prediction_id/i);
});

test('new personal-data and prediction tables are not exposed to public database roles', () => {
  assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*FROM PUBLIC/i);
  assert.doesNotMatch(sql, /\bGRANT\s+(SELECT|INSERT|UPDATE|DELETE)\b/i);
  assert.doesNotMatch(sql, /\b(DROP|TRUNCATE)\b/i);
});
