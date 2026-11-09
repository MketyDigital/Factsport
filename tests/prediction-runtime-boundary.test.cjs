const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '../lib/adapters/postgres-client.ts'),
  'utf8'
);

test('Prediction writes use a dedicated Hyperdrive identity with no shared fallback', () => {
  assert.match(source, /withFactsportPredictionPostgres/);
  assert.match(source, /FACTSPORT_PREDICTION_HYPERDRIVE/);
  assert.match(source, /factsport_v2_prediction_api/);
  assert.match(source, /Factsport Prediction API/);
  const adapter = source.slice(source.indexOf('export function withFactsportPredictionPostgres'));
  assert.doesNotMatch(adapter, /FACTSPORT_HYPERDRIVE|FACTSPORT_EDITORIAL_HYPERDRIVE|DATABASE_URL|createClient/);
});

test('Prediction readiness fails closed unless schema and minimum grants exist', () => {
  const readiness = source.slice(source.indexOf('export async function isFactsportPredictionPostgresReady'));
  assert.match(readiness, /if \(!bindings\.FACTSPORT_PREDICTION_HYPERDRIVE\?\.connectionString\) return false/);
  assert.match(readiness, /current_user = 'factsport_v2_prediction_api'/);
  for (const table of ['matches', 'prediction_contacts', 'prediction_participants', 'predictions']) {
    assert.match(readiness, new RegExp(`to_regclass\\('public\\.${table}'\\) IS NOT NULL`));
  }
  assert.match(readiness, /has_table_privilege\(current_user, 'public\.matches', 'SELECT'\)/);
  assert.match(readiness, /'public\.prediction_contacts', 'SELECT,INSERT,UPDATE'/);
  assert.match(readiness, /'public\.prediction_participants', 'SELECT,INSERT,UPDATE'/);
  assert.match(readiness, /'public\.predictions', 'SELECT,INSERT'/);
  assert.match(readiness, /catch \{\s*return false;\s*\}/);
});
