const test = require('node:test');
const assert = require('node:assert/strict');
const { readVerifiedFullTimeScore } = require('../lib/football-data-score.cjs');

test('preserves a valid 0-0 full-time score', () => {
  assert.deepEqual(readVerifiedFullTimeScore({ fullTime: { home: 0, away: 0 } }), { home: 0, away: 0 });
});

test('treats missing, partial, negative and non-integer scores as unknown', () => {
  for (const score of [
    null,
    {},
    { fullTime: { home: null, away: null } },
    { fullTime: { home: 1, away: null } },
    { fullTime: { home: -1, away: 0 } },
    { fullTime: { home: 1.5, away: 0 } },
    { fullTime: { home: '1', away: '0' } },
  ]) assert.equal(readVerifiedFullTimeScore(score), null);
});
