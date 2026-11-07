const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateMonthlyPrizeCandidate } = require('../lib/prize-qualification.cjs');

function exact(predictedHome, predictedAway, league, createdAt) {
  return {
    predicted_home_score: predictedHome,
    predicted_away_score: predictedAway,
    created_at: createdAt,
    match: { league, status: 'FT', home_score: predictedHome, away_score: predictedAway },
  };
}

test('requires every published champion criterion and honors configured thresholds', () => {
  const predictions = [
    exact(2, 1, 'PL', '2026-01-05T12:00:00Z'),
    exact(0, 1, 'PD', '2026-01-12T12:00:00Z'),
    exact(1, 1, 'BL1', '2026-01-19T12:00:00Z'),
    exact(3, 2, 'SA', '2026-01-26T12:00:00Z'),
  ];
  const result = evaluateMonthlyPrizeCandidate({
    is_vip: true, eligible_monthly_points: 120,
  }, predictions, { targetExactScores: 4, minPointsFloor: 100 });
  assert.equal(result.isQualified, true);
  assert.equal(result.reportCard.exact_score_count, 4);
  assert.equal(result.reportCard.distinct_leagues, 4);
  assert.equal(result.reportCard.weeks_active, 4);
});

test('does not rank non-VIP or below-floor candidates', () => {
  const predictions = [
    exact(2, 1, 'PL', '2026-01-05T12:00:00Z'),
    exact(0, 1, 'PD', '2026-01-12T12:00:00Z'),
    exact(1, 1, 'BL1', '2026-01-19T12:00:00Z'),
    exact(3, 2, 'SA', '2026-01-26T12:00:00Z'),
  ];
  assert.equal(evaluateMonthlyPrizeCandidate({ is_vip: false, eligible_monthly_points: 120 }, predictions).isQualified, false);
  assert.equal(evaluateMonthlyPrizeCandidate({ is_vip: true, eligible_monthly_points: 99 }, predictions).isQualified, false);
});

test('weekly activity uses all eligible predictions, while exact-score and league rules use verified finals', () => {
  const predictions = [
    exact(2, 1, 'PL', '2026-01-05T12:00:00Z'),
    exact(0, 1, 'PD', '2026-01-12T12:00:00Z'),
    exact(1, 1, 'BL1', '2026-01-12T13:00:00Z'),
    {
      predicted_home_score: 5, predicted_away_score: 0,
      created_at: '2026-01-19T13:00:00Z',
      match: { league: 'SA', status: 'LIVE', home_score: 5, away_score: 0 },
    },
  ];
  const result = evaluateMonthlyPrizeCandidate(
    { is_vip: true, eligible_monthly_points: 150 },
    predictions,
    { targetExactScores: 3, minPointsFloor: 100 },
  );
  assert.equal(result.isQualified, true);
  assert.equal(result.exactScores.length, 3);
  assert.equal(result.reportCard.distinct_leagues, 3);
  assert.equal(result.reportCard.weeks_active, 3);
});
