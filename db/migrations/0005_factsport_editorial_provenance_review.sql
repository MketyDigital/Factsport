-- Factsport V2 editorial provenance and human-review enforcement.
-- Additive only. Apply after 0004 on the isolated factsport_v2 database.
-- No legacy content is imported and no production database is modified.
BEGIN;

ALTER TABLE public.editorial_articles
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS generation_provider text,
  ADD COLUMN IF NOT EXISTS generation_model text,
  ADD COLUMN IF NOT EXISTS legacy_body text,
  ADD COLUMN IF NOT EXISTS legacy_content text;

ALTER TABLE public.editorial_articles
  DROP CONSTRAINT IF EXISTS editorial_origin_valid,
  ADD CONSTRAINT editorial_origin_valid
    CHECK (origin IN ('manual', 'ai_assisted', 'automated', 'imported', 'unknown')),
  DROP CONSTRAINT IF EXISTS editorial_review_status_valid,
  ADD CONSTRAINT editorial_review_status_valid
    CHECK (review_status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  DROP CONSTRAINT IF EXISTS editorial_publish_requires_human_review,
  ADD CONSTRAINT editorial_publish_requires_human_review
    CHECK (
      status <> 'published'
      OR (
        review_status = 'approved'
        AND reviewed_by IS NOT NULL
        AND reviewed_at IS NOT NULL
        AND published_at IS NOT NULL
      )
    );

CREATE INDEX IF NOT EXISTS editorial_articles_origin_status_idx
  ON public.editorial_articles (origin, review_status, status, updated_at DESC);

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS rights_reviewed_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS rights_reviewed_at timestamptz;

ALTER TABLE public.media_assets
  DROP CONSTRAINT IF EXISTS media_public_rights_gate,
  ADD CONSTRAINT media_public_rights_gate
    CHECK (
      NOT is_public
      OR (
        rights_status IN ('owned', 'licensed', 'editorial_exception')
        AND rights_reviewed_by IS NOT NULL
        AND rights_reviewed_by IS NOT NULL
  AND rights_reviewed_at IS NOT NULL
      )
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
  a.origin,
  a.seo_title,
  a.seo_description,
  a.original_created_at,
  a.last_verified_at
FROM public.editorial_articles a
LEFT JOIN LATERAL (
  SELECT m.object_key, m.content_type, m.alt_text, m.attribution_text
  FROM public.editorial_article_media am
  JOIN public.media_assets m ON m.id = am.media_id
  WHERE am.article_id = a.id
    AND am.placement = 'hero'
    AND m.is_public = true
    AND m.rights_status IN ('owned', 'licensed', 'editorial_exception')
    AND m.rights_reviewed_at IS NOT NULL
    AND (m.usage_expires_at IS NULL OR m.usage_expires_at > now())
  LIMIT 1
) hero ON true
WHERE a.status = 'published'
  AND a.review_status = 'approved'
  AND a.reviewed_by IS NOT NULL
  AND a.reviewed_at IS NOT NULL
  AND a.published_at <= now();

CREATE OR REPLACE VIEW public.public_media_assets AS
SELECT object_key, content_type, byte_size, sha256, width, height, alt_text,
       attribution_text
FROM public.media_assets
WHERE is_public = true
  AND rights_status IN ('owned', 'licensed', 'editorial_exception')
  AND rights_reviewed_at IS NOT NULL
  AND (usage_expires_at IS NULL OR usage_expires_at > now());

REVOKE ALL ON public.public_editorial_articles, public.public_media_assets FROM PUBLIC;
GRANT SELECT ON public.public_editorial_articles, public.public_media_assets
  TO factsport_v2_reader;

COMMIT;
