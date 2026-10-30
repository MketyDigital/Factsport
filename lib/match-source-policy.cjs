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
 * provider: 'espn' | 'football-data'\n * optional context: { nowMs, lastEspnSuccessAtMs, firstVerifiedFailureAtMs,\n *   consecutiveVerifiedFailures, upstreamFailureVerified, localPipelineHealthy,\n *   matchLinkHealthy, espnHealthy, minOutageMs, minVerifiedFailures,\n *   candidateObservedAtMs, currentObservedAtMs, maxFallbackAgeMs }
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
/**
 * Fails closed unless upstream ESPN degradation is supported by independent
 * evidence AND the local job/network/DB/queue/matcher path is healthy.
 * A stale scoreboard by itself is not evidence of an ESPN outage.
 *
 * Defaults are PROVISIONAL and must be tuned with real poll cadence/metrics.
 */
function canTemporarilyFallback(context) {
  if (!context || context.espnHealthy === true
      || context.upstreamFailureVerified !== true
      || context.localPipelineHealthy !== true
      || context.matchLinkHealthy !== true) return false;
  const now = context.nowMs;
  const lastSuccess = context.lastEspnSuccessAtMs;
  const firstFailure = context.firstVerifiedFailureAtMs;
  const minOutage = context.minOutageMs ?? 180000;
  const minFailures = context.minVerifiedFailures ?? 3;
  if (![now, lastSuccess, firstFailure, minOutage, minFailures].every(Number.isFinite)
      || minOutage < 0 || minFailures < 2
      || lastSuccess > now || firstFailure > now || firstFailure < lastSuccess) return false;
  return context.consecutiveVerifiedFailures >= minFailures
    && now - lastSuccess >= minOutage
    && now - firstFailure >= minOutage;
}

function decideScoreUpdate(match, update, provider, context = {}) {
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
      // ESPN is the preferred live provider even for FD-origin fixtures.
      if (!canTemporarilyFallback(context)) {
        return { action: 'ignore', reason: 'espn-live-authority' };
      }
      if (!LIVE.has(incoming)) {
        return { action: 'ignore', reason: 'non-live-fallback-status' };
      }
      const now = context.nowMs;
      const candidateTime = context.candidateObservedAtMs;
      const currentTime = context.currentObservedAtMs;
      const maxAge = context.maxFallbackAgeMs ?? 900000;
      if (![now, candidateTime, currentTime, maxAge].every(Number.isFinite)
          || maxAge < 0 || candidateTime > now
          || now - candidateTime > maxAge
          || candidateTime < currentTime) {
        return { action: 'ignore', reason: 'stale-fallback-snapshot' };
      }
      if (!hasFinalScore(update)) {
        return { action: 'ignore', reason: 'missing-fallback-score' };
      }
      // Decreases may be legitimate VAR corrections; never guess at correction
      // legitimacy without richer event data.
      if (hasFinalScore(match)
          && (update.homeScore < match.homeScore
              || update.awayScore < match.awayScore)) {
        return { action: 'review', reason: 'possible-score-regression' };
      }
      return { action: 'apply', reason: 'verified-espn-outage-fallback' };
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

module.exports = { canonicalStatus, hasFinalScore, canTemporarilyFallback, decideScoreUpdate };
