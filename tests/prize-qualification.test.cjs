const test = require('node:test');
const assert = require('node:assert/strict');
const { isVerifiedExactScorePrediction } = require('../lib/prize-qualification.cjs');

test('counts a verified exact score even when settlement awards 13 points', () => {
  assert.equal(isVerifiedExactScorePrediction({
    predicted_home_score: 2, predicted_away_score: 1,
    points_awarded: 13,
    match: { status: 'FT', home_score: 2, away_score: 1 },
  }), true);
});

test('does not trust a 10-point award when the final score differs', () => {
  assert.equal(isVerifiedExactScorePrediction({
    predicted_home_score: 2, predicted_away_score: 1,
    points_awarded: 10,
    match: { status: 'FT', home_score: 1, away_score: 1 },
  }), false);
});

test('does not count unknown scores or non-terminal matches', () => {
  assert.equal(isVerifiedExactScorePrediction({
    predicted_home_score: 0, predicted_away_score: 0,
    match: { status: 'LIVE', home_score: 0, away_score: 0 },
  }), false);
  assert.equal(isVerifiedExactScorePrediction({
    predicted_home_score: 0, predicted_away_score: 0,
    match: { status: 'FT', home_score: null, away_score: null },
  }), false);
});

test('handles PostgREST one-to-one relations returned as arrays', () => {
  assert.equal(isVerifiedExactScorePrediction({
    predicted_home_score: 0, predicted_away_score: 0,
    match: [{ status: 'FINISHED', home_score: 0, away_score: 0 }],
  }), true);
});
