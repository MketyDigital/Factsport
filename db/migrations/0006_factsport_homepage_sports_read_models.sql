-- Factsport V2 public homepage, highlights and competition read models.
-- Apply only after 0001/0002 on isolated factsport_v2. Empty structures only.
BEGIN;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_rank integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS season text;

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_featured_rank_nonnegative,
  ADD CONSTRAINT matches_featured_rank_nonnegative CHECK (featured_rank >= 0);

CREATE INDEX IF NOT EXISTS matches_league_season_results_idx
  ON public.matches (league, season, match_date DESC, id DESC)
  WHERE status IN ('FT', 'FINISHED', 'AET', 'PEN', 'AWARDED');

CREATE INDEX IF NOT EXISTS matches_featured_window_idx
  ON public.matches (featured_rank, match_date, id)
  WHERE is_featured = true;

CREATE TABLE IF NOT EXISTS public.homepage_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  featured_match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW public.public_homepage_settings AS
SELECT featured_match_id
FROM public.homepage_settings
WHERE singleton = true;

CREATE OR REPLACE VIEW public.public_featured_matches AS
SELECT
  id, league, home_team, away_team, home_score, away_score,
  match_date, status, home_logo, away_logo, venue, stage, match_group,
  espn_id, source, source_updated_at, version, is_featured, featured_rank,
  season
FROM public.matches
WHERE is_featured = true;

CREATE TABLE IF NOT EXISTS public.competition_standings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_code text NOT NULL,
  league_name text NOT NULL,
  season text NOT NULL,
  match_group text NOT NULL DEFAULT '',
  team_id text NOT NULL,
  team_name text NOT NULL,
  team_short_name text,
  team_crest text,
  position integer NOT NULL CHECK (position > 0),
  played_games integer NOT NULL DEFAULT 0 CHECK (played_games >= 0),
  won integer NOT NULL DEFAULT 0 CHECK (won >= 0),
  draw integer NOT NULL DEFAULT 0 CHECK (draw >= 0),
  lost integer NOT NULL DEFAULT 0 CHECK (lost >= 0),
  goals_for integer NOT NULL DEFAULT 0 CHECK (goals_for >= 0),
  goals_against integer NOT NULL DEFAULT 0 CHECK (goals_against >= 0),
  goal_difference integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  is_current boolean NOT NULL DEFAULT false,
  source text NOT NULL CHECK (source IN ('football-data', 'espn', 'manual')),
  source_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT competition_standings_team_unique
    UNIQUE (league_code, season, match_group, team_id),
  CONSTRAINT competition_standings_results_total
    CHECK (won + draw + lost <= played_games)
);
CREATE UNIQUE INDEX IF NOT EXISTS competition_one_current_season_idx
  ON public.competition_standings (league_code, match_group)
  WHERE is_current = true;
CREATE INDEX IF NOT EXISTS competition_standings_current_idx
  ON public.competition_standings (league_code, match_group, position, team_id)
  WHERE is_current = true;

CREATE OR REPLACE VIEW public.public_competition_standings AS
SELECT
  league_code, league_name, season, match_group, team_id, team_name,
  team_short_name, team_crest, position, played_games, won, draw, lost,
  goals_for, goals_against, goal_difference, points, source_updated_at
FROM public.competition_standings
WHERE is_current = true;

CREATE TABLE IF NOT EXISTS public.match_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('youtube', 'vimeo')),
  external_video_id text NOT NULL,
  title text NOT NULL,
  description text,
  canonical_url text NOT NULL,
  embed_url text NOT NULL,
  thumbnail_media_id uuid REFERENCES public.media_assets(id) ON DELETE RESTRICT,
  rights_status text NOT NULL DEFAULT 'pending'
    CHECK (rights_status IN ('pending', 'owned', 'licensed', 'editorial_exception', 'rejected', 'expired')),
  rights_reference text,
  attribution_text text,
  rights_reviewed_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  rights_reviewed_at timestamptz,
  is_public boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_highlight_video_id CHECK (
    (provider = 'youtube' AND external_video_id ~ '^[A-Za-z0-9_-]{6,64}$')
    OR (provider = 'vimeo' AND external_video_id ~ '^[0-9]{1,20}$')
  ),
  CONSTRAINT match_highlight_provider_url CHECK (
    (provider = 'youtube' AND canonical_url ~ '^https://(www\.)?(youtube\.com/watch\?v=[A-Za-z0-9_-]{6,64}|youtu\.be/[A-Za-z0-9_-]{6,64})([?&][A-Za-z0-9_=%&.-]*)?$')
    OR (provider = 'vimeo' AND canonical_url ~ '^https://vimeo\.com/[0-9]+([?&][A-Za-z0-9_=%&.-]*)?$')
  ),
  CONSTRAINT match_highlight_provider_embed CHECK (
    (provider = 'youtube' AND embed_url ~ '^https://(www\.)?(youtube\.com/embed/[A-Za-z0-9_-]{6,64}|youtube-nocookie\.com/embed/[A-Za-z0-9_-]{6,64})([?&][A-Za-z0-9_=%&.-]*)?$')
    OR (provider = 'vimeo' AND embed_url ~ '^https://player\.vimeo\.com/video/[0-9]+([?&][A-Za-z0-9_=%&.-]*)?$')
  ),
  CONSTRAINT match_highlight_rights_reference CHECK (
    rights_status NOT IN ('licensed', 'editorial_exception') OR rights_reference IS NOT NULL
  ),
  CONSTRAINT match_highlight_rights_gate CHECK (
    NOT is_public
    OR (
      rights_status IN ('owned', 'licensed', 'editorial_exception')
      AND rights_reviewed_by IS NOT NULL
      AND rights_reviewed_at IS NOT NULL
      AND published_at IS NOT NULL
    )
  )
);
CREATE INDEX IF NOT EXISTS match_highlights_public_idx
  ON public.match_highlights (published_at DESC, id DESC)
  WHERE is_public = true;

CREATE OR REPLACE VIEW public.public_match_highlights AS
SELECT
  h.id AS highlight_id, m.id AS match_id, m.league, m.home_team, m.away_team,
  m.home_logo, m.away_logo, h.provider, h.title, h.description,
  h.canonical_url, h.embed_url, h.published_at,
  thumbnail.object_key AS thumbnail_media_key,
  h.attribution_text,
  m.match_date, m.home_score, m.away_score
FROM public.match_highlights h
JOIN public.matches m ON m.id = h.match_id
LEFT JOIN LATERAL (
  SELECT ma.object_key
  FROM public.media_assets ma
  WHERE ma.id = h.thumbnail_media_id
    AND ma.is_public = true
    AND ma.rights_status IN ('owned', 'licensed', 'editorial_exception')
    AND ma.rights_reviewed_at IS NOT NULL
    AND (ma.usage_expires_at IS NULL OR ma.usage_expires_at > now())
  LIMIT 1
) thumbnail ON true
WHERE h.is_public = true
  AND h.rights_status IN ('owned', 'licensed', 'editorial_exception')
  AND h.rights_reviewed_at IS NOT NULL
  AND h.published_at <= now();

REVOKE ALL ON TABLE
  public.homepage_settings,
  public.competition_standings,
  public.match_highlights
FROM PUBLIC, factsport_v2_reader;
REVOKE ALL ON
  public.public_homepage_settings,
  public.public_featured_matches,
  public.public_competition_standings,
  public.public_match_highlights
FROM PUBLIC;
GRANT SELECT ON
  public.public_homepage_settings,
  public.public_featured_matches,
  public.public_competition_standings,
  public.public_match_highlights
TO factsport_v2_reader;

COMMIT;
)
    OR (provider = 'vimeo' AND external_video_id ~ '^[0-9]{1,20}
  CONSTRAINT match_highlight_canonical_url CHECK (
    canonical_url ~ '^https://(www\.)?(youtube\.com/watch\?v=[A-Za-z0-9_-]{6,64}|youtu\.be/[A-Za-z0-9_-]{6,64}|vimeo\.com/[0-9]+)([?&][A-Za-z0-9_=%&.-]*)?$'
  ),
  CONSTRAINT match_highlight_embed_url CHECK (
    embed_url ~ '^https://(www\.)?(youtube\.com/embed/[A-Za-z0-9_-]{6,64}|youtube-nocookie\.com/embed/[A-Za-z0-9_-]{6,64}|player\.vimeo\.com/video/[0-9]+)([?&][A-Za-z0-9_=%&.-]*)?$'
  ),
  CONSTRAINT match_highlight_rights_reference CHECK (
    rights_status NOT IN ('licensed', 'editorial_exception') OR rights_reference IS NOT NULL
  ),
  CONSTRAINT match_highlight_rights_gate CHECK (
    NOT is_public
    OR (
      rights_status IN ('owned', 'licensed', 'editorial_exception')
      AND rights_reviewed_by IS NOT NULL
      AND rights_reviewed_at IS NOT NULL
      AND published_at IS NOT NULL
    )
  )
);
CREATE INDEX IF NOT EXISTS match_highlights_public_idx
  ON public.match_highlights (published_at DESC, id DESC)
  WHERE is_public = true;

CREATE OR REPLACE VIEW public.public_match_highlights AS
SELECT
  h.id AS highlight_id, m.id AS match_id, m.league, m.home_team, m.away_team,
  m.home_logo, m.away_logo, h.provider, h.title, h.description,
  h.canonical_url, h.embed_url, h.published_at,
  thumbnail.object_key AS thumbnail_media_key,
  h.attribution_text
FROM public.match_highlights h
JOIN public.matches m ON m.id = h.match_id
LEFT JOIN LATERAL (
  SELECT ma.object_key
  FROM public.media_assets ma
  WHERE ma.id = h.thumbnail_media_id
    AND ma.is_public = true
    AND ma.rights_status IN ('owned', 'licensed', 'editorial_exception')
    AND ma.rights_reviewed_at IS NOT NULL
    AND (ma.usage_expires_at IS NULL OR ma.usage_expires_at > now())
  LIMIT 1
) thumbnail ON true
WHERE h.is_public = true
  AND h.rights_status IN ('owned', 'licensed', 'editorial_exception')
  AND h.rights_reviewed_at IS NOT NULL
  AND h.published_at <= now();

REVOKE ALL ON TABLE
  public.homepage_settings,
  public.competition_standings,
  public.match_highlights
FROM PUBLIC, factsport_v2_reader;
REVOKE ALL ON
  public.public_homepage_settings,
  public.public_featured_matches,
  public.public_competition_standings,
  public.public_match_highlights
FROM PUBLIC;
GRANT SELECT ON
  public.public_homepage_settings,
  public.public_featured_matches,
  public.public_competition_standings,
  public.public_match_highlights
TO factsport_v2_reader;

COMMIT;
)
  ),
  CONSTRAINT match_highlight_provider_url CHECK (
    (provider = 'youtube' AND canonical_url ~ '^https://(www\\.)?(youtube\\.com/watch\\?v=[A-Za-z0-9_-]{6,64}|youtu\\.be/[A-Za-z0-9_-]{6,64})([?&][A-Za-z0-9_=%&.-]*)?
  CONSTRAINT match_highlight_canonical_url CHECK (
    canonical_url ~ '^https://(www\.)?(youtube\.com/watch\?v=[A-Za-z0-9_-]{6,64}|youtu\.be/[A-Za-z0-9_-]{6,64}|vimeo\.com/[0-9]+)([?&][A-Za-z0-9_=%&.-]*)?$'
  ),
  CONSTRAINT match_highlight_embed_url CHECK (
    embed_url ~ '^https://(www\.)?(youtube\.com/embed/[A-Za-z0-9_-]{6,64}|youtube-nocookie\.com/embed/[A-Za-z0-9_-]{6,64}|player\.vimeo\.com/video/[0-9]+)([?&][A-Za-z0-9_=%&.-]*)?$'
  ),
  CONSTRAINT match_highlight_rights_reference CHECK (
    rights_status NOT IN ('licensed', 'editorial_exception') OR rights_reference IS NOT NULL
  ),
  CONSTRAINT match_highlight_rights_gate CHECK (
    NOT is_public
    OR (
      rights_status IN ('owned', 'licensed', 'editorial_exception')
      AND rights_reviewed_by IS NOT NULL
      AND rights_reviewed_at IS NOT NULL
      AND published_at IS NOT NULL
    )
  )
);
CREATE INDEX IF NOT EXISTS match_highlights_public_idx
  ON public.match_highlights (published_at DESC, id DESC)
  WHERE is_public = true;

CREATE OR REPLACE VIEW public.public_match_highlights AS
SELECT
  h.id AS highlight_id, m.id AS match_id, m.league, m.home_team, m.away_team,
  m.home_logo, m.away_logo, h.provider, h.title, h.description,
  h.canonical_url, h.embed_url, h.published_at,
  thumbnail.object_key AS thumbnail_media_key,
  h.attribution_text
FROM public.match_highlights h
JOIN public.matches m ON m.id = h.match_id
LEFT JOIN LATERAL (
  SELECT ma.object_key
  FROM public.media_assets ma
  WHERE ma.id = h.thumbnail_media_id
    AND ma.is_public = true
    AND ma.rights_status IN ('owned', 'licensed', 'editorial_exception')
    AND ma.rights_reviewed_at IS NOT NULL
    AND (ma.usage_expires_at IS NULL OR ma.usage_expires_at > now())
  LIMIT 1
) thumbnail ON true
WHERE h.is_public = true
  AND h.rights_status IN ('owned', 'licensed', 'editorial_exception')
  AND h.rights_reviewed_at IS NOT NULL
  AND h.published_at <= now();

REVOKE ALL ON TABLE
  public.homepage_settings,
  public.competition_standings,
  public.match_highlights
FROM PUBLIC, factsport_v2_reader;
REVOKE ALL ON
  public.public_homepage_settings,
  public.public_featured_matches,
  public.public_competition_standings,
  public.public_match_highlights
FROM PUBLIC;
GRANT SELECT ON
  public.public_homepage_settings,
  public.public_featured_matches,
  public.public_competition_standings,
  public.public_match_highlights
TO factsport_v2_reader;

COMMIT;
)
    OR (provider = 'vimeo' AND canonical_url ~ '^https://vimeo\\.com/[0-9]+([?&][A-Za-z0-9_=%&.-]*)?
  CONSTRAINT match_highlight_canonical_url CHECK (
    canonical_url ~ '^https://(www\.)?(youtube\.com/watch\?v=[A-Za-z0-9_-]{6,64}|youtu\.be/[A-Za-z0-9_-]{6,64}|vimeo\.com/[0-9]+)([?&][A-Za-z0-9_=%&.-]*)?$'
  ),
  CONSTRAINT match_highlight_embed_url CHECK (
    embed_url ~ '^https://(www\.)?(youtube\.com/embed/[A-Za-z0-9_-]{6,64}|youtube-nocookie\.com/embed/[A-Za-z0-9_-]{6,64}|player\.vimeo\.com/video/[0-9]+)([?&][A-Za-z0-9_=%&.-]*)?$'
  ),
  CONSTRAINT match_highlight_rights_reference CHECK (
    rights_status NOT IN ('licensed', 'editorial_exception') OR rights_reference IS NOT NULL
  ),
  CONSTRAINT match_highlight_rights_gate CHECK (
    NOT is_public
    OR (
      rights_status IN ('owned', 'licensed', 'editorial_exception')
      AND rights_reviewed_by IS NOT NULL
      AND rights_reviewed_at IS NOT NULL
      AND published_at IS NOT NULL
    )
  )
);
CREATE INDEX IF NOT EXISTS match_highlights_public_idx
  ON public.match_highlights (published_at DESC, id DESC)
  WHERE is_public = true;

CREATE OR REPLACE VIEW public.public_match_highlights AS
SELECT
  h.id AS highlight_id, m.id AS match_id, m.league, m.home_team, m.away_team,
  m.home_logo, m.away_logo, h.provider, h.title, h.description,
  h.canonical_url, h.embed_url, h.published_at,
  thumbnail.object_key AS thumbnail_media_key,
  h.attribution_text
FROM public.match_highlights h
JOIN public.matches m ON m.id = h.match_id
LEFT JOIN LATERAL (
  SELECT ma.object_key
  FROM public.media_assets ma
  WHERE ma.id = h.thumbnail_media_id
    AND ma.is_public = true
    AND ma.rights_status IN ('owned', 'licensed', 'editorial_exception')
    AND ma.rights_reviewed_at IS NOT NULL
    AND (ma.usage_expires_at IS NULL OR ma.usage_expires_at > now())
  LIMIT 1
) thumbnail ON true
WHERE h.is_public = true
  AND h.rights_status IN ('owned', 'licensed', 'editorial_exception')
  AND h.rights_reviewed_at IS NOT NULL
  AND h.published_at <= now();

REVOKE ALL ON TABLE
  public.homepage_settings,
  public.competition_standings,
  public.match_highlights
FROM PUBLIC, factsport_v2_reader;
REVOKE ALL ON
  public.public_homepage_settings,
  public.public_featured_matches,
  public.public_competition_standings,
  public.public_match_highlights
FROM PUBLIC;
GRANT SELECT ON
  public.public_homepage_settings,
  public.public_featured_matches,
  public.public_competition_standings,
  public.public_match_highlights
TO factsport_v2_reader;

COMMIT;
)
  ),
  CONSTRAINT match_highlight_provider_embed CHECK (
    (provider = 'youtube' AND embed_url ~ '^https://(www\\.)?(youtube\\.com/embed/[A-Za-z0-9_-]{6,64}|youtube-nocookie\\.com/embed/[A-Za-z0-9_-]{6,64})([?&][A-Za-z0-9_=%&.-]*)?
  CONSTRAINT match_highlight_canonical_url CHECK (
    canonical_url ~ '^https://(www\.)?(youtube\.com/watch\?v=[A-Za-z0-9_-]{6,64}|youtu\.be/[A-Za-z0-9_-]{6,64}|vimeo\.com/[0-9]+)([?&][A-Za-z0-9_=%&.-]*)?$'
  ),
  CONSTRAINT match_highlight_embed_url CHECK (
    embed_url ~ '^https://(www\.)?(youtube\.com/embed/[A-Za-z0-9_-]{6,64}|youtube-nocookie\.com/embed/[A-Za-z0-9_-]{6,64}|player\.vimeo\.com/video/[0-9]+)([?&][A-Za-z0-9_=%&.-]*)?$'
  ),
  CONSTRAINT match_highlight_rights_reference CHECK (
    rights_status NOT IN ('licensed', 'editorial_exception') OR rights_reference IS NOT NULL
  ),
  CONSTRAINT match_highlight_rights_gate CHECK (
    NOT is_public
    OR (
      rights_status IN ('owned', 'licensed', 'editorial_exception')
      AND rights_reviewed_by IS NOT NULL
      AND rights_reviewed_at IS NOT NULL
      AND published_at IS NOT NULL
    )
  )
);
CREATE INDEX IF NOT EXISTS match_highlights_public_idx
  ON public.match_highlights (published_at DESC, id DESC)
  WHERE is_public = true;

CREATE OR REPLACE VIEW public.public_match_highlights AS
SELECT
  h.id AS highlight_id, m.id AS match_id, m.league, m.home_team, m.away_team,
  m.home_logo, m.away_logo, h.provider, h.title, h.description,
  h.canonical_url, h.embed_url, h.published_at,
  thumbnail.object_key AS thumbnail_media_key,
  h.attribution_text
FROM public.match_highlights h
JOIN public.matches m ON m.id = h.match_id
LEFT JOIN LATERAL (
  SELECT ma.object_key
  FROM public.media_assets ma
  WHERE ma.id = h.thumbnail_media_id
    AND ma.is_public = true
    AND ma.rights_status IN ('owned', 'licensed', 'editorial_exception')
    AND ma.rights_reviewed_at IS NOT NULL
    AND (ma.usage_expires_at IS NULL OR ma.usage_expires_at > now())
  LIMIT 1
) thumbnail ON true
WHERE h.is_public = true
  AND h.rights_status IN ('owned', 'licensed', 'editorial_exception')
  AND h.rights_reviewed_at IS NOT NULL
  AND h.published_at <= now();

REVOKE ALL ON TABLE
  public.homepage_settings,
  public.competition_standings,
  public.match_highlights
FROM PUBLIC, factsport_v2_reader;
REVOKE ALL ON
  public.public_homepage_settings,
  public.public_featured_matches,
  public.public_competition_standings,
  public.public_match_highlights
FROM PUBLIC;
GRANT SELECT ON
  public.public_homepage_settings,
  public.public_featured_matches,
  public.public_competition_standings,
  public.public_match_highlights
TO factsport_v2_reader;

COMMIT;
)
    OR (provider = 'vimeo' AND embed_url ~ '^https://player\\.vimeo\\.com/video/[0-9]+([?&][A-Za-z0-9_=%&.-]*)?
  CONSTRAINT match_highlight_canonical_url CHECK (
    canonical_url ~ '^https://(www\.)?(youtube\.com/watch\?v=[A-Za-z0-9_-]{6,64}|youtu\.be/[A-Za-z0-9_-]{6,64}|vimeo\.com/[0-9]+)([?&][A-Za-z0-9_=%&.-]*)?$'
  ),
  CONSTRAINT match_highlight_embed_url CHECK (
    embed_url ~ '^https://(www\.)?(youtube\.com/embed/[A-Za-z0-9_-]{6,64}|youtube-nocookie\.com/embed/[A-Za-z0-9_-]{6,64}|player\.vimeo\.com/video/[0-9]+)([?&][A-Za-z0-9_=%&.-]*)?$'
  ),
  CONSTRAINT match_highlight_rights_reference CHECK (
    rights_status NOT IN ('licensed', 'editorial_exception') OR rights_reference IS NOT NULL
  ),
  CONSTRAINT match_highlight_rights_gate CHECK (
    NOT is_public
    OR (
      rights_status IN ('owned', 'licensed', 'editorial_exception')
      AND rights_reviewed_by IS NOT NULL
      AND rights_reviewed_at IS NOT NULL
      AND published_at IS NOT NULL
    )
  )
);
CREATE INDEX IF NOT EXISTS match_highlights_public_idx
  ON public.match_highlights (published_at DESC, id DESC)
  WHERE is_public = true;

CREATE OR REPLACE VIEW public.public_match_highlights AS
SELECT
  h.id AS highlight_id, m.id AS match_id, m.league, m.home_team, m.away_team,
  m.home_logo, m.away_logo, h.provider, h.title, h.description,
  h.canonical_url, h.embed_url, h.published_at,
  thumbnail.object_key AS thumbnail_media_key,
  h.attribution_text
FROM public.match_highlights h
JOIN public.matches m ON m.id = h.match_id
LEFT JOIN LATERAL (
  SELECT ma.object_key
  FROM public.media_assets ma
  WHERE ma.id = h.thumbnail_media_id
    AND ma.is_public = true
    AND ma.rights_status IN ('owned', 'licensed', 'editorial_exception')
    AND ma.rights_reviewed_at IS NOT NULL
    AND (ma.usage_expires_at IS NULL OR ma.usage_expires_at > now())
  LIMIT 1
) thumbnail ON true
WHERE h.is_public = true
  AND h.rights_status IN ('owned', 'licensed', 'editorial_exception')
  AND h.rights_reviewed_at IS NOT NULL
  AND h.published_at <= now();

REVOKE ALL ON TABLE
  public.homepage_settings,
  public.competition_standings,
  public.match_highlights
FROM PUBLIC, factsport_v2_reader;
REVOKE ALL ON
  public.public_homepage_settings,
  public.public_featured_matches,
  public.public_competition_standings,
  public.public_match_highlights
FROM PUBLIC;
GRANT SELECT ON
  public.public_homepage_settings,
  public.public_featured_matches,
  public.public_competition_standings,
  public.public_match_highlights
TO factsport_v2_reader;

COMMIT;
)
  ),
  CONSTRAINT match_highlight_canonical_url CHECK (
    canonical_url ~ '^https://(www\.)?(youtube\.com/watch\?v=[A-Za-z0-9_-]{6,64}|youtu\.be/[A-Za-z0-9_-]{6,64}|vimeo\.com/[0-9]+)([?&][A-Za-z0-9_=%&.-]*)?$'
  ),
  CONSTRAINT match_highlight_embed_url CHECK (
    embed_url ~ '^https://(www\.)?(youtube\.com/embed/[A-Za-z0-9_-]{6,64}|youtube-nocookie\.com/embed/[A-Za-z0-9_-]{6,64}|player\.vimeo\.com/video/[0-9]+)([?&][A-Za-z0-9_=%&.-]*)?$'
  ),
  CONSTRAINT match_highlight_rights_reference CHECK (
    rights_status NOT IN ('licensed', 'editorial_exception') OR rights_reference IS NOT NULL
  ),
  CONSTRAINT match_highlight_rights_gate CHECK (
    NOT is_public
    OR (
      rights_status IN ('owned', 'licensed', 'editorial_exception')
      AND rights_reviewed_by IS NOT NULL
      AND rights_reviewed_at IS NOT NULL
      AND published_at IS NOT NULL
    )
  )
);
CREATE INDEX IF NOT EXISTS match_highlights_public_idx
  ON public.match_highlights (published_at DESC, id DESC)
  WHERE is_public = true;

CREATE OR REPLACE VIEW public.public_match_highlights AS
SELECT
  h.id AS highlight_id, m.id AS match_id, m.league, m.home_team, m.away_team,
  m.home_logo, m.away_logo, h.provider, h.title, h.description,
  h.canonical_url, h.embed_url, h.published_at,
  thumbnail.object_key AS thumbnail_media_key,
  h.attribution_text
FROM public.match_highlights h
JOIN public.matches m ON m.id = h.match_id
LEFT JOIN LATERAL (
  SELECT ma.object_key
  FROM public.media_assets ma
  WHERE ma.id = h.thumbnail_media_id
    AND ma.is_public = true
    AND ma.rights_status IN ('owned', 'licensed', 'editorial_exception')
    AND ma.rights_reviewed_at IS NOT NULL
    AND (ma.usage_expires_at IS NULL OR ma.usage_expires_at > now())
  LIMIT 1
) thumbnail ON true
WHERE h.is_public = true
  AND h.rights_status IN ('owned', 'licensed', 'editorial_exception')
  AND h.rights_reviewed_at IS NOT NULL
  AND h.published_at <= now();

REVOKE ALL ON TABLE
  public.homepage_settings,
  public.competition_standings,
  public.match_highlights
FROM PUBLIC, factsport_v2_reader;
REVOKE ALL ON
  public.public_homepage_settings,
  public.public_featured_matches,
  public.public_competition_standings,
  public.public_match_highlights
FROM PUBLIC;
GRANT SELECT ON
  public.public_homepage_settings,
  public.public_featured_matches,
  public.public_competition_standings,
  public.public_match_highlights
TO factsport_v2_reader;

COMMIT;
