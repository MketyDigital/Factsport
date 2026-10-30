'use strict';

/**
 * Factsport cross-provider live-update arbitration contract.
 *
 * football-data.org bootstraps available free-tier fixtures; ESPN fills coverage gaps\n * and provides preferred faster live updates for ESPN-linked fixtures, regardless\n * of the fixture's originating provider. football-data.org supplies slower live\n * fallback for unmatched fixtures and final-time verification.\n *\n * Pure, side-effect-free decision policy: never fetches, stores, or sends posts.
 * This is NOT a fixture ingestion engine and does not replace football-data.org\n * schedule sync or ESPN cup ingestion. Existing routes are NOT yet wired to it;\n * migrating them requires
 * integration tests and explicit deployment authorization.
 *
 * score input: { status: string, homeScore: number|null, awayScore: number|null }
 * match input: { status, homeScore, awayScore, espnId?: string|null }
 * provider: 'espn' | 'football-data'
 */
const LIVE = new Set(['LIVE', 'HT', 'IN_PLAY', '1H', '2H', 'ET', 'P']);
const FINISHED = new Set(['FT', 'FINISHED', 'AET', 'PEN']);
const NOT_PLAYED = new Set(['POSTPONED', 'CANCELLED', 'SUSPENDED', 'ABD']);

function canonicalStatus(value) {
  const status = String(value || '').toUpperCase();
  if (status === 'IN_PLAY' || status === 'IN') return 'LIVE';
  if (status === 'PAUSED' || status === 'HALFTIME') return 'HT';
  if (status === 'FINISHED' || status === 'POST') return 'FT';
  return status;
}

function hasFinalScore(update) {
  return Number.isInteger(update.homeScore) && update.homeScore >= 0
    && Number.isInteger(update.awayScore) && update.awayScore >= 0;
}

/**
 * Returns an action; does not change the match. `review` is an explicit
 * *non-writing* terminal-score discrepancy for downstream approval/verification.
 */
function decideScoreUpdate(match, update, provider) {
  if (!match || !update || !['espn', 'football-data'].includes(provider)) {
    return { action: 'ignore', reason: 'invalid-input' };
  }
  const current = canonicalStatus(match.status);
  const incoming = canonicalStatus(update.status);
  const linkedToEspn = Boolean(match.espnId);
  const currentFinal = FINISHED.has(current);
  const incomingFinal = FINISHED.has(incoming);

  if (!incoming) return { action: 'ignore', reason: 'unknown-status' };
  if (NOT_PLAYED.has(incoming)) return { action: 'review', reason: 'non-played-status' };
  if (incomingFinal && !hasFinalScore(update)) {
    return { action: 'ignore', reason: 'missing-final-score' };
  }
  if (currentFinal && !incomingFinal) {
    return { action: 'ignore', reason: 'terminal-status-regression' };
  }

  if (provider === 'football-data') {
    if (linkedToEspn && !incomingFinal) {
      return { action: 'ignore', reason: 'espn-live-authority' };
    }
    if (linkedToEspn && incomingFinal) {
      if (currentFinal && match.homeScore === update.homeScore
          && match.awayScore === update.awayScore) {
        return { action: 'ignore', reason: 'final-already-verified' };
      }
      if (currentFinal && hasFinalScore(match)
          && (match.homeScore !== update.homeScore || match.awayScore !== update.awayScore)) {
        return { action: 'review', reason: 'final-score-disagreement' };
      }
      return { action: 'apply', reason: 'football-data-final-verification' };
    }
    if (currentFinal && incomingFinal && hasFinalScore(match)
        && (match.homeScore !== update.homeScore || match.awayScore !== update.awayScore)) {
      return { action: 'review', reason: 'final-score-disagreement' };
    }
    return { action: 'apply', reason: 'football-data-unmatched-live-fallback' };
  }

  if (!linkedToEspn) {
    return { action: 'ignore', reason: 'espn-link-required' };
  }
  if (currentFinal && incomingFinal && hasFinalScore(match)
      && (match.homeScore !== update.homeScore || match.awayScore !== update.awayScore)) {
    return { action: 'review', reason: 'final-score-disagreement' };
  }
  if (!LIVE.has(incoming) && !incomingFinal && incoming !== 'SCHEDULED'
      && incoming !== 'PRE_MATCH' && incoming !== 'PRE') {
    return { action: 'ignore', reason: 'unrecognized-update' };
  }
  return { action: 'apply', reason: 'espn-primary' };
}

module.exports = { canonicalStatus, hasFinalScore, decideScoreUpdate };
