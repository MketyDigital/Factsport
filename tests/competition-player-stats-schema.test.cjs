const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(
  path.join(__dirname, '../db/migrations/0007_factsport_competition_player_stats.sql'),
  'utf8'
);

test('player stats are season-aware and reject missing player identity', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.competition_player_stats/i);
  assert.match(sql, /season text NOT NULL/i);
  assert.match(sql, /player_id text NOT NULL/i);
  assert.match(sql, /UNIQUE \(league_code, season, player_id\)/i);
  assert.match(sql, /competition_player_stats_one_current_season_idx/i);
});

test('player stats constrain negative values and expose only a safe public view', () => {
  assert.match(sql, /goals integer NOT NULL DEFAULT 0 CHECK \(goals >= 0\)/i);
  assert.match(sql, /assists integer NOT NULL DEFAULT 0 CHECK \(assists >= 0\)/i);
  assert.match(sql, /appearances integer NOT NULL DEFAULT 0 CHECK \(appearances >= 0\)/i);
  assert.match(sql, /CREATE OR REPLACE VIEW public\.public_competition_player_stats/i);
  assert.match(sql, /REVOKE ALL ON TABLE public\.competition_player_stats FROM PUBLIC, factsport_v2_reader/i);
  assert.match(sql, /GRANT SELECT ON public\.public_competition_player_stats TO factsport_v2_reader/i);
  assert.doesNotMatch(sql, /\b(DROP TABLE|TRUNCATE|DELETE FROM|INSERT INTO)\b/i);
});
