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

const verifiedOutage = {
  nowMs: 600000,
  lastEspnSuccessAtMs: 0,
  firstVerifiedFailureAtMs: 180000,
  consecutiveVerifiedFailures: 3,
  upstreamFailureVerified: true,
  localPipelineHealthy: true,
  matchLinkHealthy: true,
  espnHealthy: false,
  candidateObservedAtMs: 580000,
  currentObservedAtMs: 550000
};
test('verified ESPN upstream failure permits a fresh football-data live snapshot', () => {
  assert.deepEqual(decideScoreUpdate(base,
    { status: 'IN_PLAY', homeScore: 2, awayScore: 0 }, 'football-data', verifiedOutage),
    { action: 'apply', reason: 'verified-espn-outage-fallback' });
});
test('mere ESPN data staleness without independently verified upstream failure is not an outage', () => {
  assert.equal(decideScoreUpdate(base,
    { status: 'IN_PLAY', homeScore: 2, awayScore: 0 }, 'football-data',
    { ...verifiedOutage, upstreamFailureVerified: false }).reason, 'espn-live-authority');
});
test('local scheduler, DB or network failure cannot trigger a provider failover', () => {
  assert.equal(decideScoreUpdate(base,
    { status: 'IN_PLAY', homeScore: 2, awayScore: 0 }, 'football-data',
    { ...verifiedOutage, localPipelineHealthy: false }).reason, 'espn-live-authority');
});
test('matchmaker link problems cannot be misclassified as an ESPN outage', () => {
  assert.equal(decideScoreUpdate(base,
    { status: 'IN_PLAY', homeScore: 2, awayScore: 0 }, 'football-data',
    { ...verifiedOutage, matchLinkHealthy: false }).reason, 'espn-live-authority');
});
test('too few independent failures or too short outage cannot cause fallback', () => {
  const candidate = { status: 'IN_PLAY', homeScore: 2, awayScore: 0 };
  assert.equal(decideScoreUpdate(base, candidate, 'football-data',
    { ...verifiedOutage, consecutiveVerifiedFailures: 2 }).reason, 'espn-live-authority');
  assert.equal(decideScoreUpdate(base, candidate, 'football-data',
    { ...verifiedOutage, nowMs: 220000 }).reason, 'espn-live-authority');
});
test('ESPN recovery immediately restores ESPN live authority', () => {
  const candidate = { status: 'IN_PLAY', homeScore: 2, awayScore: 0 };
  assert.equal(decideScoreUpdate(base, candidate, 'football-data',
    { ...verifiedOutage, espnHealthy: true }).reason, 'espn-live-authority');
  assert.equal(decideScoreUpdate(base, candidate, 'espn',
    { ...verifiedOutage, espnHealthy: true }).reason, 'espn-primary');
});
test('FD fallback cannot overwrite a newer ESPN score with delayed data', () => {
  assert.equal(decideScoreUpdate(base,
    { status: 'IN_PLAY', homeScore: 2, awayScore: 0 }, 'football-data',
    { ...verifiedOutage, candidateObservedAtMs: 500000 }).reason, 'stale-fallback-snapshot');
});
test('FD live snapshot without reliable observation time is rejected', () => {
  assert.equal(decideScoreUpdate(base,
    { status: 'IN_PLAY', homeScore: 2, awayScore: 0 }, 'football-data',
    { ...verifiedOutage, candidateObservedAtMs: null }).reason, 'stale-fallback-snapshot');
});
test('unexpected score decrease is not auto-applied even in verified ESPN outage', () => {
  assert.deepEqual(decideScoreUpdate({ ...base, homeScore: 2 },
    { status: 'IN_PLAY', homeScore: 1, awayScore: 0 }, 'football-data', verifiedOutage),
    { action: 'review', reason: 'possible-score-regression' });
});
test('already finished match must not revert to delayed football-data live state', () => {
  assert.equal(decideScoreUpdate({ ...base, status: 'FT' },
    { status: 'IN_PLAY', homeScore: 2, awayScore: 0 }, 'football-data', verifiedOutage).reason,
    'terminal-status-regression');
});
