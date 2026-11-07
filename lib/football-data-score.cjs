function readNonNegativeScore(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\\d+$/.test(value.trim())) return null;
  const score = Number(value);
  return Number.isSafeInteger(score) && score >= 0 ? score : null;
}

function readVerifiedFullTimeScore(score) {
  const home = readNonNegativeScore(score?.fullTime?.home);
  const away = readNonNegativeScore(score?.fullTime?.away);
  if (home === null || away === null) return null;
  return { home, away };
}

module.exports = { readNonNegativeScore, readVerifiedFullTimeScore };
