const test = require('node:test');
const assert = require('node:assert/strict');
const { detectMatchSocialEvent } = require('../lib/social-match-event-policy.cjs');

const kickoff = '2026-11-07T18:00:00.000Z';
const nowMs = Date.parse('2026-11-07T18:12:00.000Z');
const base = {
  id: 'match-1', home_team: 'Arsenal', away_team: 'Chelsea',
  home_score: 0, away_score: 0, status: 'LIVE', match_date: kickoff,
  league: 'Premier League', match_events: [], lineups: { home: [], away: [] },
};

test('goal transitions are deterministic and carry a stable event identity', () => {
  const result = detectMatchSocialEvent({
    oldMatch: base,
    newMatch: { ...base, home_score: 1, match_events: [{ id: 'espn-goal-7', type: 'goal', player: 'Saka', time: '12' }] },
    nowMs,
  });
  assert.equal(result.baseEventKey, 'goals');
  assert.equal(result.eventKey, 'goals_score-1-espn-goal-7');
  assert.equal(result.dedupeKey, 'match-1:goals_score-1-espn-goal-7');
  assert.match(result.details.scorer, /Saka/);
  assert.equal(result.match.home_score, 1);
});

test('missing or malformed scores never become an invented 0-0 or a goal event', () => {
  const result = detectMatchSocialEvent({
    oldMatch: base,
    newMatch: { ...base, home_score: 1, away_score: null, match_events: [{ type: 'goal', player: 'Saka', time: '12' }] },
    nowMs,
  });
  assert.equal(result, null);
});

test('terminal status transition remains a fulltime event without fabricating scores', () => {
  const result = detectMatchSocialEvent({
    oldMatch: base,
    newMatch: { ...base, status: 'FT', home_score: null, away_score: null },
    nowMs,
  });
  assert.equal(result.baseEventKey, 'fulltime');
  assert.equal(result.match.home_score, null);
  assert.equal(detectMatchSocialEvent({
    oldMatch: { ...base, status: 'FT' },
    newMatch: { ...base, status: 'AET' },
    nowMs,
  }), null);
});

test('VAR score decreases, penalty additions, kickoff and half-time retain distinct event families', () => {
  const varResult = detectMatchSocialEvent({
    oldMatch: { ...base, home_score: 1 },
    newMatch: { ...base, home_score: 0 },
    nowMs,
  });
  assert.equal(varResult.baseEventKey, 'var_overturn');

  const penaltyResult = detectMatchSocialEvent({
    oldMatch: base,
    newMatch: { ...base, match_events: [{ id: 'pen-1', type: 'penalty_awarded', time: '12' }] },
    nowMs,
  });
  assert.equal(penaltyResult.baseEventKey, 'penalty_awarded');

  const kickoffResult = detectMatchSocialEvent({
    oldMatch: { ...base, status: 'PRE_MATCH' },
    newMatch: base,
    nowMs,
  });
  assert.equal(kickoffResult.baseEventKey, 'kickoff');

  const halfTimeResult = detectMatchSocialEvent({
    oldMatch: base,
    newMatch: { ...base, status: 'HT' },
    nowMs,
  });
  assert.equal(halfTimeResult.baseEventKey, 'halftime');
});

test('lineup publication requires full elevens for both teams', () => {
  const eleven = Array.from({ length: 11 }, (_, i) => ({ name: 'Player ' + i }));
  const result = detectMatchSocialEvent({
    oldMatch: base,
    newMatch: { ...base, lineups: { home: eleven, away: eleven } },
    nowMs,
  });
  assert.equal(result.baseEventKey, 'lineups');
  assert.ok(result.dedupeKey.includes('lineups'));
});

test('stale goal commentary and records without a canonical match ID are ignored', () => {
  const stale = detectMatchSocialEvent({
    oldMatch: base,
    newMatch: { ...base, match_date: '2026-11-07T15:00:00.000Z', home_score: 1, match_events: [{ id: 'old-goal', type: 'goal', player: 'Saka', time: '1' }] },
    nowMs,
  });
  assert.equal(stale, null);
  assert.equal(detectMatchSocialEvent({ oldMatch: base, newMatch: { ...base, id: '' }, nowMs }), null);
});
