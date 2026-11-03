-- Factsport v2 clean-start operational schema. Run only against factsport_v2.
-- No old Supabase rows are imported; no DROP statements.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id text UNIQUE,
  espn_id text UNIQUE,
  league text NOT NULL,
  home_team text NOT NULL,
  away_team text NOT NULL,
  home_score integer,
  away_score integer,
  match_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'SCHEDULED',
  home_logo text,
  away_logo text,
  venue text,
  stage text,
  match_group text,
  match_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  lineups jsonb NOT NULL DEFAULT '{}'::jsonb,
  h2h jsonb,
  referees jsonb NOT NULL DEFAULT '[]'::jsonb,
  predictor jsonb,
  points_distributed boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'football-data',
  source_updated_at timestamptz,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_scores CHECK (
    (home_score IS NULL OR home_score >= 0) AND
    (away_score IS NULL OR away_score >= 0)
  )
);
CREATE INDEX IF NOT EXISTS matches_league_date_idx
  ON public.matches (league, match_date);
CREATE INDEX IF NOT EXISTS matches_status_date_idx
  ON public.matches (status, match_date);
CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.external_identities (
  issuer text NOT NULL,
  subject text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (issuer, subject)
);
CREATE INDEX IF NOT EXISTS external_identities_user_idx
  ON public.external_identities(user_id);
CREATE TABLE IF NOT EXISTS public.job_runs (
  run_key text PRIMARY KEY,
  job_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error_code text
);
COMMIT;
