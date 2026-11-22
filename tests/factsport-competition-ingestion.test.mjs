import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeFootballDataScorers,
  normalizeFootballDataStandings,
} from '../lib/ingestion/factsport-competition.mjs';

const standings = () => ({
  competition: { code: 'PL', name: 'Premier League' },
  season: { startDate: '2026-08-01', endDate: '2027-05-30' },
  standings: [{
    type: 'TOTAL',
    group: null,
    table: Array.from({ length: 20 }, (_, index) => ({
      position: index + 1,
      team: {
        id: index + 1,
        name: `Club ${index + 1}`,
        shortName: `C${index + 1}`,
        crest: 'https://unapproved.example/crest.png',
      },
      playedGames: 2,
      won: 1,
      draw: 1,
      lost: 0,
      points: 4,
      goalsFor: 3,
      goalsAgainst: 1,
      goalDifference: 2,
      form: 'W,D',
    })),
  }],
});

test('normalizes only complete football-data TOTAL standings without remote crests', () => {
  const normalized = normalizeFootballDataStandings(standings(), 'PL');
  assert.equal(normalized.leagueCode, 'PL');
  assert.equal(normalized.season, '2026');
  assert.equal(normalized.rows.length, 20);
  assert.equal(normalized.rows[0].match_group, '');
  assert.equal(normalized.rows[0].form, 'W,D');
  assert.equal(normalized.rows[0].team_crest, null);
  assert.equal(normalized.rows[0].source, 'football-data');
});

test('rejects incomplete, wrong-competition, duplicate-team, and malformed standings snapshots', () => {
  const incomplete = standings();
  incomplete.standings[0].table = incomplete.standings[0].table.slice(0, 17);
  assert.equal(normalizeFootballDataStandings(incomplete, 'PL'), null);
  assert.equal(normalizeFootballDataStandings(standings(), 'PD'), null);

  const duplicate = standings();
  duplicate.standings[0].table[1].team.id = duplicate.standings[0].table[0].team.id;
  assert.equal(normalizeFootballDataStandings(duplicate, 'PL'), null);

  const invalid = standings();
  invalid.standings[0].table[0].goalDifference = 90;
  assert.equal(normalizeFootballDataStandings(invalid, 'PL'), null);
});

test('normalizes scorer rows and preserves unknown assists/appearances/minutes as null', () => {
  const payload = {
    competition: { code: 'PL', name: 'Premier League' },
    season: { startDate: '2026-08-01' },
    scorers: [{
      player: { id: 501, name: 'Player One' },
      team: { id: 42, name: 'Club One', shortName: 'C1', crest: 'https://unapproved.example/crest.png' },
      goals: 8,
      assists: null,
    }],
  };
  const normalized = normalizeFootballDataScorers(payload, 'PL');
  assert.equal(normalized.season, '2026');
  assert.equal(normalized.rows.length, 1);
  assert.equal(normalized.rows[0].goals, 8);
  assert.equal(normalized.rows[0].assists, null);
  assert.equal(normalized.rows[0].appearances, null);
  assert.equal(normalized.rows[0].minutes_played, null);
  assert.equal(normalized.rows[0].team_crest, null);
});

test('accepts a valid empty scorer snapshot and rejects invalid or duplicate player rows', () => {
  const empty = {
    competition: { code: 'PL', name: 'Premier League' },
    season: { startDate: '2026-08-01' },
    scorers: [],
  };
  assert.deepEqual(normalizeFootballDataScorers(empty, 'PL').rows, []);

  const duplicate = { ...empty, scorers: [
    { player: { id: 1, name: 'One' }, team: { id: 1, name: 'Club' }, goals: 1, assists: 0 },
    { player: { id: 1, name: 'One' }, team: { id: 1, name: 'Club' }, goals: 2, assists: 0 },
  ] };
  assert.equal(normalizeFootballDataScorers(duplicate, 'PL'), null);
});
