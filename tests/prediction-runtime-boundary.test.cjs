const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '../lib/adapters/postgres-client.ts'),
  'utf8'
);
const migration = fs.readFileSync(
  path.join(__dirname, '../db/migrations/0043_factsport_prediction_submission_function.sql'),
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

test('Prediction readiness requires only the scoped function capability, not direct table writes', () => {
  const readiness = source.slice(source.indexOf('export async function isFactsportPredictionPostgresReady'));
  assert.match(readiness, /if \(!bindings\.FACTSPORT_PREDICTION_HYPERDRIVE\?\.connectionString\) return false/);
  assert.match(readiness, /current_user = 'factsport_v2_prediction_api'/);
  assert.match(readiness, /to_regprocedure\(/);
  assert.match(readiness, /public\.submit_public_prediction\(text,text,text,uuid,text,text,text,integer,integer\)/);
  assert.match(readiness, /has_function_privilege\([\s\S]*?'EXECUTE'/);
  assert.match(readiness, /consume_public_prediction_rate_limit/);
  assert.match(readiness, /rate_limit_function_executable === true/);
  assert.doesNotMatch(readiness, /has_table_privilege/);
  assert.match(readiness, /catch \{\s*return false;\s*\}/);
});

test('Prediction submission SQL is atomic, closed to PUBLIC and denies direct API-role table grants', () => {
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /SET search_path = pg_catalog, public/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /'SCHEDULED', 'PRE_MATCH'/);
  assert.match(migration, /transaction_timestamp\(\)/);
  assert.match(migration, /ON CONFLICT \(participant_id, match_id\) DO NOTHING/);
  assert.match(migration, /REVOKE ALL ON FUNCTION[\s\S]*?FROM PUBLIC/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION[\s\S]*?TO factsport_v2_prediction_api/);
  assert.match(migration, /prediction_submission_rate_limits/);
  assert.match(migration, /consume_public_prediction_rate_limit/);
  assert.match(migration, /p_scope NOT IN \('visitor', 'network'\)/);
  assert.doesNotMatch(migration, /GRANT (SELECT|INSERT|UPDATE|DELETE|ALL).*prediction_(contacts|participants|submission_rate_limits)|GRANT (SELECT|INSERT|UPDATE|DELETE|ALL).*public\.predictions/i);
  assert.match(migration, /is_eligible_for_prize,[\s\S]*?false/);
});

test('Prediction submission function does not accept client-supplied participant or user IDs', () => {
  const signature = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION'), migration.indexOf('RETURNS TABLE'));
  assert.match(signature, /p_visitor_token_hash text/);
  assert.match(signature, /p_email_address text/);
  assert.match(signature, /p_match_id uuid/);
  assert.doesNotMatch(signature, /participant_id|user_id/);
});
