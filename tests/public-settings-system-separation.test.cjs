const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('legacy public settings response is preserved through separate Media and Prediction projections', () => {
  const migration = read('db/migrations/0018_factsport_prediction_affiliate_settings.sql');
  const predictionAdapter = read('lib/adapters/postgres-prediction-settings.ts');
  const mediaAdapter = read('lib/adapters/postgres-homepage.ts');
  const route = read('app/api/settings/route.ts');

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.prediction_affiliate_settings/i);
  assert.match(migration, /CREATE OR REPLACE VIEW public\.public_prediction_affiliate_settings/i);
  assert.match(migration, /GRANT SELECT ON public\.public_prediction_affiliate_settings TO factsport_v2_reader/i);
  assert.doesNotMatch(migration, /factsport_v2_editorial_writer/);
  assert.match(predictionAdapter, /public\.public_prediction_affiliate_settings/);
  assert.match(mediaAdapter, /public\.public_homepage_settings/);
  for (const field of ['link1x', 'linkMel', 'code1x', 'codeMel', 'featured_match_id']) {
    assert.match(route, new RegExp(field));
  }
  assert.match(route, /getPublicHomepageSettings/);
  assert.match(route, /getPublicPredictionAffiliateSettings/);
  assert.match(route, /Promise\.all/);
  assert.match(route, /FACTSPORT_HOMEPAGE_BACKEND/);
  assert.match(route, /FACTSPORT_PREDICTION_SETTINGS_BACKEND/);
  assert.match(route, /FACTSPORT_ENVIRONMENT === 'production'/);
  assert.doesNotMatch(route, /link1x: null/);
});
