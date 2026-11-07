/**
 * Monthly prize qualification helpers.
 * A prediction is an exact score only when its linked match has a verified
 * terminal result and both predicted scores equal the recorded final scores.
 */
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
  if (!values.every((value) => Number.isInteger(value) && value >= 0)) return false;
  return prediction.predicted_home_score === match.home_score &&
    prediction.predicted_away_score === match.away_score;
}

module.exports = { isVerifiedExactScorePrediction };
