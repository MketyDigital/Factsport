function readVerifiedFullTimeScore(score) {
  const home = score?.fullTime?.home;
  const away = score?.fullTime?.away;
  if (!Number.isInteger(home) || home < 0 || !Number.isInteger(away) || away < 0) return null;
  return { home, away };
}

module.exports = { readVerifiedFullTimeScore };
