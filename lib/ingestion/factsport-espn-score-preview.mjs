/**
 * Read-only parity comparison for fixtures that already have an approved ESPN ID.
 * This module never mutates a fixture or proposes new ID links.
 */
const SCORE_STATUSES = new Set(['LIVE', 'FT', 'PRE_MATCH']);

export function compareLinkedEspnFixture(fixture, event) {
  if (!fixture || !event || !fixture.espn_id || fixture.espn_id !== event.espn_id) {
    return { outcome: 'invalid_input', wouldUpdate: false, scoreChanged: false, statusChanged: false };
  }
  if (!SCORE_STATUSES.has(event.status)) {
    return { outcome: 'unsupported_status', wouldUpdate: false, scoreChanged: false, statusChanged: false };
  }
  const currentStatus = String(fixture.status || '').toUpperCase();
  const statusChanged = currentStatus !== event.status;
  const hasProviderScore = Number.isSafeInteger(event.home_score) &&
    Number.isSafeInteger(event.away_score) && event.home_score >= 0 && event.away_score >= 0;
  const scoreChanged = hasProviderScore &&
    (fixture.home_score !== event.home_score || fixture.away_score !== event.away_score);
  return {
    outcome: statusChanged || scoreChanged ? 'parity_difference' : 'in_sync',
    wouldUpdate: statusChanged || scoreChanged,
    scoreChanged,
    statusChanged,
    expectedStatus: event.status,
    expectedHomeScore: hasProviderScore ? event.home_score : null,
    expectedAwayScore: hasProviderScore ? event.away_score : null,
  };
}
