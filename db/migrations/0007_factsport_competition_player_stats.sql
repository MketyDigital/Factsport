-- Factsport V2 season-aware public player-statistics read model.
-- Create empty; provider ingestion must populate new data only after reconciliation.
BEGIN;

CREATE TABLE IF NOT EXISTS public.competition_player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_code text NOT NULL,
  league_name text NOT NULL,
  season text NOT NULL,
  player_id text NOT NULL,
  player_name text NOT NULL,
  team_id text,
  team_name text NOT NULL,
  team_short_name text,
  team_crest text,
  goals integer NOT NULL DEFAULT 0 CHECK (goals >= 0),
  assists integer NOT NULL DEFAULT 0 CHECK (assists >= 0),
  appearances integer NOT NULL DEFAULT 0 CHECK (appearances >= 0),
  minutes_played integer NOT NULL DEFAULT 0 CHECK (minutes_played >= 0),
  is_current boolean NOT NULL DEFAULT false,
  source text NOT NULL CHECK (source IN ('football-data', 'espn', 'manual')),
  source_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT competition_player_stats_player_unique
    UNIQUE (league_code, season, player_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS competition_player_stats_one_current_season_idx
  ON public.competition_player_stats (league_code)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS competition_player_stats_goals_idx
  ON public.competition_player_stats (league_code, goals DESC, assists DESC, player_id)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS competition_player_stats_assists_idx
  ON public.competition_player_stats (league_code, assists DESC, goals DESC, player_id)
  WHERE is_current = true;

CREATE OR REPLACE VIEW public.public_competition_player_stats AS
SELECT
  league_code, league_name, season, player_id, player_name,
  team_id, team_name, team_short_name, team_crest,
  goals, assists, appearances, minutes_played, source_updated_at
FROM public.competition_player_stats
WHERE is_current = true;

REVOKE ALL ON TABLE public.competition_player_stats FROM PUBLIC, factsport_v2_reader;
REVOKE ALL ON public.public_competition_player_stats FROM PUBLIC;
GRANT SELECT ON public.public_competition_player_stats TO factsport_v2_reader;

COMMIT;
