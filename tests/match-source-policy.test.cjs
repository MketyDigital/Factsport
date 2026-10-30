'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { canonicalStatus, decideScoreUpdate } = require('../lib/match-source-policy.cjs');

const base = { status: 'LIVE', homeScore: 1, awayScore: 0, espnId: 'espn-42' };

test('normalizes known provider states', () => {
  assert.equal(canonicalStatus('IN_PLAY'), 'LIVE');
  assert.equal(canonicalStatus('PAUSED'), 'HT');
  assert.equal(canonicalStatus('FINISHED'), 'FT');
});
test('ESPN-linked live result takes precedence over football-data live updates', () => {
  assert.deepEqual(decideScoreUpdate(base,
    { status: 'IN_PLAY', homeScore: 0, awayScore: 0 }, 'football-data'),
    { action: 'ignore', reason: 'espn-live-authority' });
});
test('ESPN matched live update is accepted', () => {
  assert.equal(decideScoreUpdate(base,
    { status: 'LIVE', homeScore: 2, awayScore: 0 }, 'espn').action, 'apply');
});
test('cannot pretend an unlinked match is ESPN matched', () => {
  assert.equal(decideScoreUpdate({ ...base, espnId: null },
    { status: 'LIVE', homeScore: 2, awayScore: 0 }, 'espn').action, 'ignore');
});
test('unmatched fixture can receive football-data fallback', () => {
  assert.deepEqual(decideScoreUpdate({ ...base, espnId: null },
    { status: 'LIVE', homeScore: 2, awayScore: 1 }, 'football-data'),
    { action: 'apply', reason: 'football-data-unmatched-live-fallback' });
});
test('football-data may verify ESPN-linked FT when status was live', () => {
  assert.deepEqual(decideScoreUpdate(base,
    { status: 'FINISHED', homeScore: 2, awayScore: 1 }, 'football-data'),
    { action: 'apply', reason: 'football-data-final-verification' });
});
test('an existing FT score disagreement is held for review, not auto-overwritten', () => {
  assert.deepEqual(decideScoreUpdate({ ...base, status: 'FT' },
    { status: 'FT', homeScore: 2, awayScore: 1 }, 'football-data'),
    { action: 'review', reason: 'final-score-disagreement' });
});
test('FT without actual numeric scores cannot become fake 0-0', () => {
  assert.deepEqual(decideScoreUpdate(base,
    { status: 'FT', homeScore: null, awayScore: null }, 'football-data'),
    { action: 'ignore', reason: 'missing-final-score' });
});
test('late pre-match or live update cannot regress an FT result', () => {
  assert.equal(decideScoreUpdate({ ...base, status: 'FT' },
    { status: 'LIVE', homeScore: 0, awayScore: 0 }, 'espn').reason,
    'terminal-status-regression');
});
test('abandoned games require explicit review rather than automatic settlement', () => {
  assert.deepEqual(decideScoreUpdate(base,
    { status: 'ABD', homeScore: 1, awayScore: 0 }, 'football-data'),
    { action: 'review', reason: 'non-played-status' });
});
test('identical verified FT result does not trigger repeated write', () => {
  assert.deepEqual(decideScoreUpdate({ ...base, status: 'FT' },
    { status: 'FINISHED', homeScore: 1, awayScore: 0 }, 'football-data'),
    { action: 'ignore', reason: 'final-already-verified' });
});

test('football-data sourced fixture with apiId still accepts delayed live data when ESPN is unmatched', () => {
  const fixture = { status: 'SCHEDULED', homeScore: null, awayScore: null, apiId: 'fd-711', espnId: null };
  assert.deepEqual(decideScoreUpdate(fixture,
    { status: 'IN_PLAY', homeScore: 0, awayScore: 1 }, 'football-data'),
    { action: 'apply', reason: 'football-data-unmatched-live-fallback' });
});
test('ESPN gap-fill cup fixture receives ESPN live feed even when it has no FD provider id', () => {
  const fixture = { status: 'SCHEDULED', homeScore: null, awayScore: null, apiId: null, espnId: 'espn-cup-113' };
  assert.deepEqual(decideScoreUpdate(fixture,
    { status: 'IN_PLAY', homeScore: 1, awayScore: 0 }, 'espn'),
    { action: 'apply', reason: 'espn-primary' });
});
test('football-data primary fixture matched to ESPN uses ESPN for faster live updates', () => {
  const fixture = { status: 'LIVE', homeScore: 0, awayScore: 0, apiId: 'fd-711', espnId: 'espn-113' };
  assert.equal(decideScoreUpdate(fixture,
    { status: 'LIVE', homeScore: 1, awayScore: 0 }, 'espn').action, 'apply');
  assert.equal(decideScoreUpdate(fixture,
    { status: 'IN_PLAY', homeScore: 0, awayScore: 0 }, 'football-data').reason,
    'espn-live-authority');
});
