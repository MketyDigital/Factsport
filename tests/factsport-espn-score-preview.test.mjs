import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLinkedEspnFixture } from '../lib/ingestion/factsport-espn-score-preview.mjs';

const fixture = {
  espn_id: '123456789', status: 'LIVE', home_score: 1, away_score: 0,
};

test('reports an already synchronized linked fixture', () => {
  const result = compareLinkedEspnFixture(fixture, {
    espn_id: '123456789', status: 'LIVE', home_score: 1, away_score: 0,
  });
  assert.equal(result.outcome, 'in_sync');
  assert.equal(result.wouldUpdate, false);
});

test('detects score and status differences without mutating inputs', () => {
  const before = structuredClone(fixture);
  const result = compareLinkedEspnFixture(fixture, {
    espn_id: '123456789', status: 'FT', home_score: 2, away_score: 0,
  });
  assert.equal(result.outcome, 'parity_difference');
  assert.equal(result.wouldUpdate, true);
  assert.equal(result.scoreChanged, true);
  assert.equal(result.statusChanged, true);
  assert.deepEqual(fixture, before);
});

test('does not infer a missing provider score as zero', () => {
  const result = compareLinkedEspnFixture(fixture, {
    espn_id: '123456789', status: 'LIVE', home_score: null, away_score: null,
  });
  assert.equal(result.outcome, 'in_sync');
  assert.equal(result.scoreChanged, false);
});

test('rejects mismatched ESPN IDs and unsupported provider states', () => {
  assert.equal(compareLinkedEspnFixture(fixture, {
    espn_id: 'other', status: 'FT', home_score: 2, away_score: 0,
  }).outcome, 'invalid_input');
  assert.equal(compareLinkedEspnFixture(fixture, {
    espn_id: '123456789', status: 'UNKNOWN', home_score: 2, away_score: 0,
  }).outcome, 'unsupported_status');
});
