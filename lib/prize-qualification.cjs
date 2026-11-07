function firstMatch(value) {
  return Array.isArray(value) ? value[0] : value;
}

function isVerifiedExactScorePrediction(prediction) {
  const match = firstMatch(prediction?.match);
  if (!match || !["FT", "FINISHED"].includes(match.status)) return false;
  const values = [
    prediction.predicted_home_score,
    prediction.predicted_away_score,
    match.home_score,
    match.away_score,
  ];
  if (!values.every((value) => Number.isSafeInteger(value) && value >= 0)) return false;
  return prediction.predicted_home_score === match.home_score &&
    prediction.predicted_away_score === match.away_score;
}

function evaluateMonthlyPrizeCandidate(user, predictions, settings = {}) {
  const targetExactScores = Number.isSafeInteger(settings.targetExactScores) && settings.targetExactScores > 0
    ? settings.targetExactScores : 4;
  const minPointsFloor = Number.isFinite(settings.minPointsFloor) && settings.minPointsFloor >= 0
    ? settings.minPointsFloor : 100;
  const exactScores = predictions.filter(isVerifiedExactScorePrediction);

  const weeksActive = new Set(predictions.map((prediction) => {
    const date = new Date(prediction.created_at);
    if (!Number.isFinite(date.valueOf())) return null;
    const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
    const dayOfYear = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - yearStart) / 86400000);
    return `${date.getUTCFullYear()}-${Math.floor(dayOfYear / 7)}`;
  }).filter(Boolean)).size;

  const leagues = new Set(exactScores.map((prediction) => firstMatch(prediction.match)?.league).filter(Boolean));
  const hasHome = exactScores.some((p) => p.predicted_home_score > p.predicted_away_score);
  const hasAway = exactScores.some((p) => p.predicted_home_score < p.predicted_away_score);
  const hasDraw = exactScores.some((p) => p.predicted_home_score === p.predicted_away_score);
  const scoreStrings = exactScores.map((p) => `${p.predicted_home_score}-${p.predicted_away_score}`);
  const uniqueScores = new Set(scoreStrings).size;
  const zeroZeroCount = scoreStrings.filter((score) => score === "0-0").length;

  const passVip = user?.is_vip === true;
  const points = Number(user?.eligible_monthly_points) || 0;
  const passFloor = points >= minPointsFloor;
  const passActive = weeksActive >= 3;
  const passExactCount = exactScores.length >= targetExactScores;
  const passLeagues = leagues.size >= targetExactScores;
  const passMix = hasHome && hasAway && hasDraw;
  const passVariety = uniqueScores > 1 && zeroZeroCount <= 1;
  const isQualified = passVip && passFloor && passActive && passExactCount &&
    passLeagues && passMix && passVariety;

  return {
    isQualified,
    exactScores,
    points,
    reportCard: {
      vip_and_floor: passVip && passFloor && passExactCount,
      active_player: passActive,
      exact_score_count: exactScores.length,
      target_exact_scores: targetExactScores,
      distinct_leagues: leagues.size,
      required_leagues: targetExactScores,
      weeks_active: weeksActive,
      four_leagues: passLeagues,
      perfect_mix: passMix,
      score_variety: passVariety,
      is_passed: isQualified,
    },
  };
}

module.exports = { isVerifiedExactScorePrediction, evaluateMonthlyPrizeCandidate };
