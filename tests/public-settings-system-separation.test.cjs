const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Media settings endpoint exposes only the Media homepage projection', () => {
  const mediaAdapter = read('lib/adapters/postgres-homepage.ts');
  const route = read('app/api/settings/route.ts');
  assert.match(mediaAdapter, /public\.public_homepage_settings/);
  assert.match(route, /getPublicHomepageSettings/);
  assert.match(route, /featured_match_id/);
  assert.doesNotMatch(route, /getPublicPredictionAffiliateSettings|link_1xbet|link_melbet|code_1xbet|code_melbet/);
});

test('Prediction affiliate settings are isolated behind the configured private host', () => {
  const migration = read('db/migrations/0018_factsport_prediction_affiliate_settings.sql');
  const predictionAdapter = read('lib/adapters/postgres-prediction-settings.ts');
  const route = read('app/api/prediction/settings/route.ts');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.prediction_affiliate_settings/i);
  assert.match(migration, /CREATE OR REPLACE VIEW public\.public_prediction_affiliate_settings/i);
  assert.match(predictionAdapter, /public\.public_prediction_affiliate_settings/);
  assert.match(route, /FACTSPORT_PRIVATE_PRODUCT_HOST/);
  assert.match(route, /getPublicPredictionAffiliateSettings/);
  assert.match(route, /requestHost !== privateHost/);
});
