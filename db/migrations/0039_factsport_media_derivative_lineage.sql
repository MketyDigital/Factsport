-- Immutable image derivative lineage and rights inheritance at public-read time.
BEGIN;

CREATE TABLE IF NOT EXISTS public.media_asset_derivatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_asset_id uuid NOT NULL REFERENCES public.media_assets(id) ON DELETE RESTRICT,
  derivative_asset_id uuid NOT NULL UNIQUE REFERENCES public.media_assets(id) ON DELETE RESTRICT,
  variant_key text NOT NULL CHECK (variant_key IN ('hero_16_9','social_square','thumbnail_4_3','team_square')),
  transform_spec jsonb NOT NULL CHECK (jsonb_typeof(transform_spec)='object'),
  created_by uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_asset_derivative_distinct CHECK (source_asset_id <> derivative_asset_id)
);

CREATE INDEX IF NOT EXISTS media_asset_derivatives_source_idx
  ON public.media_asset_derivatives (source_asset_id, variant_key, created_at DESC);

REVOKE ALL ON public.media_asset_derivatives
  FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer,
       factsport_v2_espn_writer, factsport_v2_social_dispatcher;
GRANT SELECT, INSERT ON public.media_asset_derivatives TO factsport_v2_editorial_writer;

ALTER TABLE public.media_editorial_audit_events
  DROP CONSTRAINT IF EXISTS media_editorial_audit_events_action_check,
  ADD CONSTRAINT media_editorial_audit_events_action_check CHECK (action IN (
    'draft_saved', 'submitted_for_review', 'review_approved', 'review_rejected',
    'published', 'archived', 'media_uploaded', 'media_rights_reviewed',
    'media_detached', 'media_derivative_created', 'source_added',
    'social_scheduled', 'social_cancelled', 'social_channel_configured',
    'membership_granted', 'membership_revoked'
  ));

-- Derivatives inherit the source asset's current rights eligibility. Revoking or
-- expiring the original immediately removes its derivatives from public views.
CREATE OR REPLACE VIEW public.public_media_assets AS
SELECT DISTINCT m.object_key, m.content_type, m.byte_size, m.sha256,
       m.width, m.height, m.alt_text, m.attribution_text
FROM public.media_assets m
WHERE m.is_public = true
  AND m.rights_status IN ('owned', 'licensed', 'editorial_exception')
  AND m.rights_reviewed_by IS NOT NULL
  AND m.rights_reviewed_at IS NOT NULL
  AND (m.usage_expires_at IS NULL OR m.usage_expires_at > now())
  AND NOT EXISTS (
    SELECT 1
    FROM public.media_asset_derivatives d
    JOIN public.media_assets source ON source.id=d.source_asset_id
    WHERE d.derivative_asset_id=m.id
      AND (
        source.rights_status NOT IN ('owned','licensed','editorial_exception')
        OR source.rights_reviewed_by IS NULL
        OR source.rights_reviewed_at IS NULL
        OR (source.usage_expires_at IS NOT NULL AND source.usage_expires_at <= now())
      )
  )
  AND (
    EXISTS (
      SELECT 1 FROM public.editorial_article_media am
      JOIN public.editorial_articles a ON a.id=am.article_id
      WHERE am.media_id=m.id AND a.status='published'
        AND a.review_status='approved' AND a.reviewed_by IS NOT NULL
        AND a.reviewed_at IS NOT NULL AND a.published_at <= now()
    )
    OR EXISTS (
      SELECT 1 FROM public.editorial_article_team_media tm
      JOIN public.editorial_articles a ON a.id=tm.article_id
      WHERE tm.media_id=m.id AND a.status='published'
        AND a.review_status='approved' AND a.reviewed_by IS NOT NULL
        AND a.reviewed_at IS NOT NULL AND a.published_at <= now()
    )
  );

CREATE OR REPLACE VIEW public.public_social_media_assets AS
SELECT m.id, m.object_key, m.content_type, m.byte_size, m.sha256,
       m.width, m.height, m.alt_text, m.attribution_text
FROM public.media_assets m
WHERE m.media_kind='image'
  AND m.is_public=true
  AND m.rights_status IN ('owned','licensed','editorial_exception')
  AND m.rights_reviewed_by IS NOT NULL
  AND m.rights_reviewed_at IS NOT NULL
  AND (m.usage_expires_at IS NULL OR m.usage_expires_at > now())
  AND NOT EXISTS (
    SELECT 1
    FROM public.media_asset_derivatives d
    JOIN public.media_assets source ON source.id=d.source_asset_id
    WHERE d.derivative_asset_id=m.id
      AND (
        source.rights_status NOT IN ('owned','licensed','editorial_exception')
        OR source.rights_reviewed_by IS NULL
        OR source.rights_reviewed_at IS NULL
        OR (source.usage_expires_at IS NOT NULL AND source.usage_expires_at <= now())
      )
  )
  AND (
    EXISTS (
      SELECT 1 FROM public.editorial_article_media am
      JOIN public.editorial_articles a ON a.id=am.article_id
      WHERE am.media_id=m.id AND a.status='published' AND a.review_status='approved'
        AND a.reviewed_by IS NOT NULL AND a.reviewed_at IS NOT NULL AND a.published_at <= now()
    )
    OR EXISTS (
      SELECT 1 FROM public.editorial_article_team_media tm
      JOIN public.editorial_articles a ON a.id=tm.article_id
      WHERE tm.media_id=m.id AND a.status='published' AND a.review_status='approved'
        AND a.reviewed_by IS NOT NULL AND a.reviewed_at IS NOT NULL AND a.published_at <= now()
    )
  );

CREATE OR REPLACE VIEW public.public_editorial_article_inline_media AS
SELECT a.id AS article_id, am.position, m.object_key, m.content_type,
       m.byte_size, m.width, m.height, m.alt_text, m.attribution_text
FROM public.editorial_article_media am
JOIN public.editorial_articles a ON a.id=am.article_id
JOIN public.media_assets m ON m.id=am.media_id
WHERE am.placement='inline'
  AND a.status='published' AND a.review_status='approved'
  AND a.reviewed_by IS NOT NULL AND a.reviewed_at IS NOT NULL
  AND a.published_at <= now()
  AND m.is_public=true
  AND m.rights_status IN ('owned','licensed','editorial_exception')
  AND m.rights_reviewed_by IS NOT NULL AND m.rights_reviewed_at IS NOT NULL
  AND (m.usage_expires_at IS NULL OR m.usage_expires_at > now())
  AND NOT EXISTS (
    SELECT 1
    FROM public.media_asset_derivatives d
    JOIN public.media_assets source ON source.id=d.source_asset_id
    WHERE d.derivative_asset_id=m.id
      AND (
        source.rights_status NOT IN ('owned','licensed','editorial_exception')
        OR source.rights_reviewed_by IS NULL
        OR source.rights_reviewed_at IS NULL
        OR (source.usage_expires_at IS NOT NULL AND source.usage_expires_at <= now())
      )
  );

-- Keep the article hero/team projections subject to the same inherited-rights check.
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
  JOIN public.media_assets m ON m.id=am.media_id
  WHERE am.article_id=a.id AND am.placement='hero'
    AND m.is_public=true AND m.rights_status IN ('owned','licensed','editorial_exception')
    AND m.rights_reviewed_by IS NOT NULL AND m.rights_reviewed_at IS NOT NULL
    AND (m.usage_expires_at IS NULL OR m.usage_expires_at > now())
    AND NOT EXISTS (
      SELECT 1 FROM public.media_asset_derivatives d
      JOIN public.media_assets source ON source.id=d.source_asset_id
      WHERE d.derivative_asset_id=m.id AND (
        source.rights_status NOT IN ('owned','licensed','editorial_exception')
        OR source.rights_reviewed_by IS NULL OR source.rights_reviewed_at IS NULL
        OR (source.usage_expires_at IS NOT NULL AND source.usage_expires_at <= now())
      )
    )
  LIMIT 1
) hero ON true
LEFT JOIN LATERAL (
  SELECT m.object_key
  FROM public.editorial_article_team_media tm
  JOIN public.media_assets m ON m.id=tm.media_id
  WHERE tm.article_id=a.id AND tm.team_side='team_1'
    AND m.is_public=true AND m.rights_status IN ('owned','licensed','editorial_exception')
    AND m.rights_reviewed_by IS NOT NULL AND m.rights_reviewed_at IS NOT NULL
    AND (m.usage_expires_at IS NULL OR m.usage_expires_at > now())
    AND NOT EXISTS (
      SELECT 1 FROM public.media_asset_derivatives d
      JOIN public.media_assets source ON source.id=d.source_asset_id
      WHERE d.derivative_asset_id=m.id AND (
        source.rights_status NOT IN ('owned','licensed','editorial_exception')
        OR source.rights_reviewed_by IS NULL OR source.rights_reviewed_at IS NULL
        OR (source.usage_expires_at IS NOT NULL AND source.usage_expires_at <= now())
      )
    )
  LIMIT 1
) team1 ON true
LEFT JOIN LATERAL (
  SELECT m.object_key
  FROM public.editorial_article_team_media tm
  JOIN public.media_assets m ON m.id=tm.media_id
  WHERE tm.article_id=a.id AND tm.team_side='team_2'
    AND m.is_public=true AND m.rights_status IN ('owned','licensed','editorial_exception')
    AND m.rights_reviewed_by IS NOT NULL AND m.rights_reviewed_at IS NOT NULL
    AND (m.usage_expires_at IS NULL OR m.usage_expires_at > now())
    AND NOT EXISTS (
      SELECT 1 FROM public.media_asset_derivatives d
      JOIN public.media_assets source ON source.id=d.source_asset_id
      WHERE d.derivative_asset_id=m.id AND (
        source.rights_status NOT IN ('owned','licensed','editorial_exception')
        OR source.rights_reviewed_by IS NULL OR source.rights_reviewed_at IS NULL
        OR (source.usage_expires_at IS NOT NULL AND source.usage_expires_at <= now())
      )
    )
  LIMIT 1
) team2 ON true
WHERE a.status='published' AND a.review_status='approved'
  AND a.reviewed_by IS NOT NULL AND a.reviewed_at IS NOT NULL
  AND a.published_at <= now();

REVOKE ALL ON public.media_asset_derivatives FROM PUBLIC;
REVOKE ALL ON public.public_media_assets, public.public_social_media_assets,
  public.public_editorial_article_inline_media, public.public_editorial_articles FROM PUBLIC;
GRANT SELECT ON public.public_media_assets, public.public_social_media_assets,
  public.public_editorial_article_inline_media, public.public_editorial_articles
  TO factsport_v2_reader;
GRANT SELECT ON public.public_social_media_assets TO factsport_v2_social_dispatcher;

COMMIT;
