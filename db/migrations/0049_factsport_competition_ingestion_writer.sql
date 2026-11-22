-- Factsport V2 competition snapshot ingestion. Forward-only, no legacy imports.
BEGIN;

ALTER TABLE public.competition_standings
  ADD COLUMN IF NOT EXISTS form text NOT NULL DEFAULT '';
ALTER TABLE public.competition_standings
  DROP CONSTRAINT IF EXISTS competition_standings_form_format,
  ADD CONSTRAINT competition_standings_form_format
    CHECK (form = '' OR form ~ '^(W|D|L)(,(W|D|L)){0,4}$');

-- Append form to the public view so PostgreSQL can replace it without changing
-- the order or meaning of existing projected columns.
CREATE OR REPLACE VIEW public.public_competition_standings AS
SELECT
  league_code, league_name, season, match_group, team_id, team_name,
  team_short_name, team_crest, position, played_games, won, draw, lost,
  goals_for, goals_against, goal_difference, points, source_updated_at, form
FROM public.competition_standings
WHERE is_current = true;

-- The provider does not consistently supply assists, appearances, or minutes.
-- Null means unknown; do not misrepresent missing values as zero.
ALTER TABLE public.competition_player_stats
  ALTER COLUMN assists DROP NOT NULL,
  ALTER COLUMN assists DROP DEFAULT,
  ALTER COLUMN appearances DROP NOT NULL,
  ALTER COLUMN appearances DROP DEFAULT,
  ALTER COLUMN minutes_played DROP NOT NULL,
  ALTER COLUMN minutes_played DROP DEFAULT;

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'factsport_v2_competition_writer') THEN
    CREATE ROLE factsport_v2_competition_writer
      NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOREPLICATION NOBYPASSRLS;
  END IF;
END
$role$;

ALTER ROLE factsport_v2_competition_writer
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO factsport_v2_competition_writer;
GRANT SELECT, INSERT, UPDATE ON
  public.competition_standings,
  public.competition_player_stats
TO factsport_v2_competition_writer;

REVOKE ALL ON
  public.competition_standings,
  public.competition_player_stats
FROM PUBLIC,
  factsport_v2_reader,
  factsport_v2_schedule_writer,
  factsport_v2_espn_writer,
  factsport_v2_editorial_writer;

COMMIT;
