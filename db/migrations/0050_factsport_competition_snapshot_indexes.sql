-- Fix V2 competition snapshot indexes: current snapshots contain one row per team/player.
-- Keep indexed reads, but do not enforce one row per league or group.
BEGIN;

DROP INDEX IF EXISTS public.competition_one_current_season_idx;
DROP INDEX IF EXISTS public.competition_player_stats_one_current_season_idx;

CREATE INDEX IF NOT EXISTS competition_standings_current_snapshot_idx
  ON public.competition_standings (league_code, season, match_group, position, team_id)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS competition_player_stats_current_snapshot_idx
  ON public.competition_player_stats (league_code, season, goals DESC, assists DESC, player_id)
  WHERE is_current = true;

COMMIT;
