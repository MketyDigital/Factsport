import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../workers/factsport-competition-sync.mjs', import.meta.url), 'utf8');
const provisioner = fs.readFileSync(new URL('../workers/factsport-competition-role-provision.ts', import.meta.url), 'utf8');
const config = fs.readFileSync(new URL('../wrangler.factsport-competition-sync.jsonc', import.meta.url), 'utf8');

test('competition snapshots use a separate Hyperdrive login and scheduled staging worker', () => {
  assert.match(config, /"name": "factsport-v2-competition-sync"/);
  assert.match(config, /"0 4,16 \* \* \*"/);
  assert.match(config, /"binding": "FACTSPORT_HYPERDRIVE"/);
  assert.match(worker, /current_user = 'factsport_v2_competition_app'/);
  assert.match(worker, /pg_has_role\(current_user, 'factsport_v2_competition_writer', 'USAGE'\)/);
  assert.match(worker, /can_update_matches === false/);
  assert.match(worker, /can_delete_matches === false/);
  assert.match(worker, /standings_snapshot_index_ready === true/);
  assert.match(worker, /scorer_multirow_index_ready === true/);
});

test('competition sync writes only standings and scorer snapshots, never match results', () => {
  assert.match(worker, /INSERT INTO public\.competition_standings/);
  assert.match(worker, /INSERT INTO public\.competition_player_stats/);
  assert.doesNotMatch(worker, /INSERT INTO public\.matches|UPDATE public\.matches/);
  assert.match(worker, /sql\.begin\(async tx =>/);
  assert.match(worker, /normalizeFootballDataStandings/);
  assert.match(worker, /normalizeFootballDataScorers/);
  assert.match(worker, /STANDINGS_COMPETITIONS = new Set\(\['PL', 'PD', 'BL1', 'SA', 'FL1'\]\)/);
  assert.match(worker, /standings: standings \? 'updated' : 'not_supported'/);
  assert.ok(worker.includes('STANDINGS_COMPETITIONS.has(code)'));
  assert.ok(worker.includes('PROVIDER_REQUEST_SPACING_MS = 8000'));
});

test('manual sync is authenticated, read-only in dry-run mode, and reports counts only', () => {
  assert.match(worker, /__internal\/competition-sync/);
  assert.match(worker, /tokenMatches/);
  assert.match(worker, /body\.dryRun === true/);
  assert.match(worker, /if \(dryRun\)/);
  assert.match(worker, /standingsRows: Number\(counts\.standings_rows\)/);
  assert.doesNotMatch(worker, /player_name:\s*row|team_name:\s*row/);
});

test('role provisioner validates exact admin database and grants only isolated writer membership', () => {
  assert.match(provisioner, /current_database\(\) AS database, current_user AS connected_as/);
  assert.match(provisioner, /identity\.database !== 'factsport_v2'/);
  assert.match(provisioner, /identity\.connected_as !== 'mketydbadmin'/);
  assert.match(provisioner, /GRANT factsport_v2_competition_writer TO factsport_v2_competition_app/);
  assert.match(provisioner, /can_update_matches === false/);
  assert.match(provisioner, /can_delete_matches === false/);
  assert.match(provisioner, /CONNECTION LIMIT 3/);
});
