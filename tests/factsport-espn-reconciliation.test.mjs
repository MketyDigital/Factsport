import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEspnScoreboardEvent, findUniqueEspnFixtureCandidate } from '../lib/ingestion/factsport-espn-reconciliation.mjs';

const raw = {
  id: '123456789',
  date: '2026-11-07T15:00:00Z',
  competitions: [{
    competitors: [
      { homeAway: 'home', team: { displayName: 'Arsenal FC' }, score: '2' },
      { homeAway: 'away', team: { displayName: 'Chelsea' }, score: '1' },
    ],
  }],
  status: { type: { state: 'in' }, displayClock: '67:12' },
};
const fixture = {
  id: 'fixture-1', league: 'Premier League',
  home_team: 'Arsenal', away_team: 'Chelsea FC',
  match_date: '2026-11-07T15:00:00Z', espn_id: null,
  source: 'football-data', status: 'SCHEDULED', points_distributed: false,
};

test('normalizes ESPN scoreboard event without inventing score values', () => {
  const event = normalizeEspnScoreboardEvent(raw, 'Premier League');
  assert.equal(event.espn_id, '123456789');
  assert.equal(event.status, 'LIVE');
  assert.equal(event.home_score, 2);
  assert.equal(event.away_score, 1);
  assert.equal(event.displayClock, '67:12');
  const missing = normalizeEspnScoreboardEvent({
    ...raw, competitions: [{ ...raw.competitions[0], competitors: [
      { homeAway: 'home', team: { displayName: 'Arsenal' } },
      { homeAway: 'away', team: { displayName: 'Chelsea' } },
    ] }],
  }, 'Premier League');
  assert.equal(missing.home_score, null);
  assert.equal(missing.away_score, null);
});

test('rejects incomplete or malformed ESPN events', () => {
  assert.equal(normalizeEspnScoreboardEvent(null, 'Premier League'), null);
  assert.equal(normalizeEspnScoreboardEvent({ ...raw, id: 'bad/id' }, 'Premier League'), null);
  assert.equal(normalizeEspnScoreboardEvent({ ...raw, date: 'not-a-date' }, 'Premier League'), null);
  assert.equal(normalizeEspnScoreboardEvent({ ...raw, competitions: [] }, 'Premier League'), null);
});

test('finds a unique exact team and kickoff candidate without mutating either object', () => {
  const event = normalizeEspnScoreboardEvent(raw, 'Premier League');
  const before = structuredClone(fixture);
  const result = findUniqueEspnFixtureCandidate(event, [fixture]);
  assert.equal(result.outcome, 'unique_candidate');
  assert.equal(result.candidate.id, 'fixture-1');
  assert.deepEqual(fixture, before);
  assert.equal('espn_id' in fixture, true);
  assert.equal(fixture.espn_id, null);
});

test('does not auto-link ambiguous, pre-linked, wrong-league, distant or unsafe fixtures', () => {
  const event = normalizeEspnScoreboardEvent(raw, 'Premier League');
  assert.equal(findUniqueEspnFixtureCandidate(event, [fixture, { ...fixture, id: 'fixture-2' }]).outcome, 'ambiguous');
  assert.equal(findUniqueEspnFixtureCandidate(event, [{ ...fixture, espn_id: 'already-linked' }]).outcome, 'no_match');
  assert.equal(findUniqueEspnFixtureCandidate(event, [{ ...fixture, league: 'La Liga' }]).outcome, 'no_match');
  assert.equal(findUniqueEspnFixtureCandidate(event, [{ ...fixture, match_date: '2026-11-07T18:00:01Z' }]).outcome, 'no_match');
  assert.equal(findUniqueEspnFixtureCandidate(event, [{ ...fixture, points_distributed: true }]).outcome, 'no_match');
  assert.equal(findUniqueEspnFixtureCandidate(event, [{ ...fixture, status: 'FT' }]).outcome, 'no_match');
  assert.equal(findUniqueEspnFixtureCandidate(event, [{ ...fixture, source: 'manual' }]).outcome, 'no_match');
});

test('never links a reversed home/away pairing', () => {
  const event = normalizeEspnScoreboardEvent(raw, 'Premier League');
  assert.equal(findUniqueEspnFixtureCandidate(event, [{
    ...fixture, home_team: 'Chelsea', away_team: 'Arsenal',
  }]).outcome, 'no_match');
});
