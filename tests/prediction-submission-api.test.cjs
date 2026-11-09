const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const helper = fs.readFileSync(
  path.join(__dirname, '../lib/prediction/public-submission.ts'),
  'utf8'
);
const route = fs.readFileSync(
  path.join(__dirname, '../app/api/prediction/submit/route.ts'),
  'utf8'
);

test('Prediction visitor cookie is opaque, cryptographically random and HttpOnly/Secure', () => {
  assert.match(helper, /crypto\.getRandomValues/);
  assert.match(helper, /Uint8Array\(32\)/);
  assert.match(helper, /__Secure-factsport_prediction_visitor/);
  assert.match(helper, /httpOnly: true/);
  assert.match(helper, /secure: true/);
  assert.match(helper, /sameSite: 'lax'/);
  assert.match(helper, /maxAge: 60 \* 60 \* 24 \* 180/);
  assert.match(helper, /domain = '\.factsport\.com'/);
  assert.match(helper, /SHA-256/);
});

test('Prediction public API is host-gated, same-origin, bounded and no-store', () => {
  assert.match(route, /FACTSPORT_PREDICTION_SUBMISSION_READY/);
  assert.match(route, /isAllowedPredictionPublicHost/);
  assert.match(route, /origin !== new URL\(request\.url\)\.origin/);
  assert.match(route, /MAX_BODY_BYTES = 8192/);
  assert.match(route, /readBoundedJson/);
  assert.match(route, /Cache-Control': 'private, no-store/);
  assert.match(route, /unsupported_request_field/);
  assert.match(route, /acceptRules !== true/);
});

test('Prediction API uses only the dedicated DB function and keyed privacy-safe rate limits', () => {
  assert.match(route, /isFactsportPredictionPostgresReady/);
  assert.match(route, /withFactsportPredictionPostgres/);
  assert.match(route, /submit_public_prediction/);
  assert.match(route, /consume_public_prediction_rate_limit/);
  assert.match(route, /cf-connecting-ip/);
  assert.match(route, /keyedPredictionHash/);
  assert.doesNotMatch(route, /createClient|SUPABASE|DATABASE_URL|console\.(log|error)/);
});

test('Prediction submit endpoint does not accept marketing consent before a separate consent API exists', () => {
  assert.match(route, /const acceptedFields = new Set/);
  assert.doesNotMatch(route, /marketingOptIn|marketingConsent/);
});
