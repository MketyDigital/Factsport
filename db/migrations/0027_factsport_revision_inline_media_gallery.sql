-- Ordered, revision-scoped inline editorial media gallery.
-- Existing hero/team attachments retain position 0 and their current semantics.
-- Public gallery rows are projected only for published articles and approved rights.
BEGIN;

ALTER TABLE public.editorial_article_revision_media
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

ALTER TABLE public.editorial_article_revision_media
  DROP CONSTRAINT IF EXISTS editorial_article_revision_media_placement_check,
  ADD CONSTRAINT editorial_article_revision_media_placement_check
    CHECK (placement IN ('hero', 'team_1', 'team_2', 'inline'));

ALTER TABLE public.editorial_article_revision_media
  DROP CONSTRAINT IF EXISTS editorial_article_revision_media_position_check,
  ADD CONSTRAINT editorial_article_revision_media_position_check
    CHECK (position >= 0 AND (placement = 'inline' OR position = 0));

ALTER TABLE public.editorial_article_revision_media
  DROP CONSTRAINT IF EXISTS editorial_article_revision_media_pkey,
  ADD CONSTRAINT editorial_article_revision_media_pkey
    PRIMARY KEY (revision_id, placement, position);

CREATE INDEX IF NOT EXISTS editorial_revision_media_inline_order_idx
  ON public.editorial_article_revision_media (revision_id, position)
  WHERE placement = 'inline';

CREATE OR REPLACE VIEW public.public_editorial_article_inline_media AS
SELECT
  a.id AS article_id,
  am.position,
  m.object_key,
  m.content_type,
  m.byte_size,
  m.width,
  m.height,
  m.alt_text,
  m.attribution_text
FROM public.editorial_article_media am
JOIN public.editorial_articles a ON a.id = am.article_id
JOIN public.media_assets m ON m.id = am.media_id
WHERE am.placement = 'inline'
  AND a.status = 'published'
  AND a.review_status = 'approved'
  AND a.reviewed_by IS NOT NULL
  AND a.reviewed_at IS NOT NULL
  AND a.published_at <= now()
  AND m.is_public = true
  AND m.rights_status IN ('owned', 'licensed', 'editorial_exception')
  AND m.rights_reviewed_by IS NOT NULL
  AND m.rights_reviewed_at IS NOT NULL
  AND (m.usage_expires_at IS NULL OR m.usage_expires_at > now());

REVOKE ALL ON public.public_editorial_article_inline_media FROM PUBLIC;
GRANT SELECT ON public.public_editorial_article_inline_media TO factsport_v2_reader;

COMMIT;
