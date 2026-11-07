-- Preserve legacy match-article identity/media fields while moving public media to rights-cleared R2 assets.
-- Additive only; raw legacy URL references are private migration provenance, never public URLs.
BEGIN;

ALTER TABLE public.editorial_articles
  ADD COLUMN IF NOT EXISTS team_1_name text,
  ADD COLUMN IF NOT EXISTS team_2_name text,
  ADD COLUMN IF NOT EXISTS legacy_media_references jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.editorial_articles
  DROP CONSTRAINT IF EXISTS editorial_legacy_media_references_object,
  ADD CONSTRAINT editorial_legacy_media_references_object
    CHECK (jsonb_typeof(legacy_media_references) = 'object'),
  DROP CONSTRAINT IF EXISTS editorial_team_names_length,
  ADD CONSTRAINT editorial_team_names_length CHECK (
    (team_1_name IS NULL OR char_length(team_1_name) <= 120) AND
    (team_2_name IS NULL OR char_length(team_2_name) <= 120)
  );

CREATE TABLE IF NOT EXISTS public.editorial_article_team_media (
  article_id uuid NOT NULL REFERENCES public.editorial_articles(id) ON DELETE CASCADE,
  team_side text NOT NULL CHECK (team_side IN ('team_1', 'team_2')),
  media_id uuid NOT NULL REFERENCES public.media_assets(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, team_side)
);

CREATE OR REPLACE VIEW public.public_editorial_articles AS
SELECT
  a.id, a.slug, a.title, a.excerpt, a.body_markdown, a.category, a.tags,
  a.is_headline, a.is_breaking, a.author_display_name,
  a.published_at, a.created_at, a.updated_at, a.canonical_url,
  hero.object_key AS hero_media_key,
  hero.content_type AS hero_media_content_type,
  hero.alt_text AS hero_media_alt_text,
  hero.attribution_text AS hero_media_attribution,
  a.origin, a.seo_title, a.seo_description, a.original_created_at, a.last_verified_at,
  a.team_1_name, a.team_2_name,
  team1.object_key AS team_1_logo_key,
  team2.object_key AS team_2_logo_key
FROM public.editorial_articles a
LEFT JOIN LATERAL (
  SELECT m.object_key, m.content_type, m.alt_text, m.attribution_text
  FROM public.editorial_article_media am
  JOIN public.media_assets m ON m.id = am.media_id
  WHERE am.article_id = a.id AND am.placement = 'hero'
    AND m.is_public = true
    AND m.rights_status IN ('owned', 'licensed', 'editorial_exception')
    AND m.rights_reviewed_by IS NOT NULL AND m.rights_reviewed_at IS NOT NULL
    AND (m.usage_expires_at IS NULL OR m.usage_expires_at > now())
  LIMIT 1
) hero ON true
LEFT JOIN LATERAL (
  SELECT m.object_key
  FROM public.editorial_article_team_media tm
  JOIN public.media_assets m ON m.id = tm.media_id
  WHERE tm.article_id = a.id AND tm.team_side = 'team_1'
    AND m.is_public = true
    AND m.rights_status IN ('owned', 'licensed', 'editorial_exception')
    AND m.rights_reviewed_by IS NOT NULL AND m.rights_reviewed_at IS NOT NULL
    AND (m.usage_expires_at IS NULL OR m.usage_expires_at > now())
  LIMIT 1
) team1 ON true
LEFT JOIN LATERAL (
  SELECT m.object_key
  FROM public.editorial_article_team_media tm
  JOIN public.media_assets m ON m.id = tm.media_id
  WHERE tm.article_id = a.id AND tm.team_side = 'team_2'
    AND m.is_public = true
    AND m.rights_status IN ('owned', 'licensed', 'editorial_exception')
    AND m.rights_reviewed_by IS NOT NULL AND m.rights_reviewed_at IS NOT NULL
    AND (m.usage_expires_at IS NULL OR m.usage_expires_at > now())
  LIMIT 1
) team2 ON true
WHERE a.status = 'published'
  AND a.review_status = 'approved'
  AND a.reviewed_by IS NOT NULL
  AND a.reviewed_at IS NOT NULL
  AND a.published_at <= now();

REVOKE ALL ON public.editorial_article_team_media FROM PUBLIC, factsport_v2_reader;
GRANT SELECT ON public.public_editorial_articles TO factsport_v2_reader;

COMMIT;
