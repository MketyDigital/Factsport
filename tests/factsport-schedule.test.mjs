import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFactsportSchedule, factsportDateWindow } from '../lib/ingestion/factsport-schedule.mjs';

const now = new Date('2026-11-03T00:00:00Z');
const base = {
  id: 123456, utcDate: '2026-11-07T15:00:00Z', status: 'TIMED',
  homeTeam: { shortName: 'Home', crest: 'https://crests.football-data.org/home.svg' },
  awayTeam: { name: 'Away', crest: 'https://crests.football-data.org/away.svg' },
  stage: 'REGULAR_SEASON',
};
test('normalize scheduled PL fixture, without scores or ESPN IDs', () => {
  const x = normalizeFactsportSchedule(base, 'Premier League', now);
  assert.equal(x.api_id, '123456');
  assert.equal(x.status, 'SCHEDULED');
  assert.equal(x.home_team, 'Home');
  assert.equal(x.away_team, 'Away');
  assert.equal('home_score' in x, false);
  assert.equal('espn_id' in x, false);
});
test('never import live or finished statuses', () => {
  for (const status of ['IN_PLAY', 'PAUSED', 'FINISHED', 'AWARDED', 'LIVE', 'FT']) {
    assert.equal(normalizeFactsportSchedule({ ...base, status }, 'Premier League', now), null);
  }
});
test('rejects unknown league, invalid date and missing team', () => {
  assert.equal(normalizeFactsportSchedule(base, 'Unknown', now), null);
  assert.equal(normalizeFactsportSchedule({ ...base, utcDate:'bad' }, 'Premier League', now), null);
  assert.equal(normalizeFactsportSchedule({ ...base, homeTeam: null }, 'Premier League', now), null);
});
test('date window is bounded and chronological', () => {
  assert.deepEqual(factsportDateWindow(now, 21),
    { dateFrom: '2026-11-02', dateTo: '2026-11-24' });
  assert.throws(() => factsportDateWindow(now, 366));
});
test('validates logo urls and preserves postponed schedule status', () => {
  const x = normalizeFactsportSchedule({
    ...base, status: 'POSTPONED',
    homeTeam: { shortName: 'Home', crest: 'javascript:bad' },
  }, 'Premier League', now);
  assert.equal(x.status, 'POSTPONED');
  assert.equal(x.home_logo, null);
});
