function readNonNegativeScore(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null;
  const score = Number(value);
  return Number.isSafeInteger(score) && score >= 0 ? score : null;
}

function readVerifiedFullTimeScore(score) {
  const home = score?.fullTime?.home;
  const away = score?.fullTime?.away;
  if (!Number.isSafeInteger(home) || home < 0 || !Number.isSafeInteger(away) || away < 0) return null;
  return { home, away };
}

module.exports = { readNonNegativeScore, readVerifiedFullTimeScore };
