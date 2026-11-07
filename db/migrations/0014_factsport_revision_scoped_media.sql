-- Revision-scoped media attachments. Published article media changes only when the matching
-- revision passes independent editorial approval; uploaded/rights-reviewed assets remain private until then.
BEGIN;

CREATE TABLE IF NOT EXISTS public.editorial_article_revision_media (
  revision_id uuid NOT NULL REFERENCES public.editorial_article_revisions(id) ON DELETE CASCADE,
  placement text NOT NULL CHECK (placement IN ('hero', 'team_1', 'team_2')),
  media_id uuid REFERENCES public.media_assets(id) ON DELETE RESTRICT,
  remove_media boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (revision_id, placement),
  CONSTRAINT editorial_revision_media_action CHECK (
    (media_id IS NOT NULL AND remove_media = false) OR
    (media_id IS NULL AND remove_media = true)
  )
);

REVOKE ALL ON public.editorial_article_revision_media
  FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer, factsport_v2_espn_writer;
GRANT SELECT, INSERT, UPDATE ON public.editorial_article_revision_media
  TO factsport_v2_editorial_writer;

-- Public media is only discoverable when attached to an approved, published article.
CREATE OR REPLACE VIEW public.public_media_assets AS
SELECT DISTINCT m.object_key, m.content_type, m.byte_size, m.sha256, m.width, m.height,
       m.alt_text, m.attribution_text
FROM public.media_assets m
WHERE m.is_public = true
  AND m.rights_status IN ('owned', 'licensed', 'editorial_exception')
  AND m.rights_reviewed_by IS NOT NULL
  AND m.rights_reviewed_at IS NOT NULL
  AND (m.usage_expires_at IS NULL OR m.usage_expires_at > now())
  AND (
    EXISTS (
      SELECT 1 FROM public.editorial_article_media am
      JOIN public.editorial_articles a ON a.id = am.article_id
      WHERE am.media_id = m.id AND a.status = 'published'
        AND a.review_status = 'approved' AND a.reviewed_by IS NOT NULL
        AND a.reviewed_at IS NOT NULL AND a.published_at <= now()
    )
    OR EXISTS (
      SELECT 1 FROM public.editorial_article_team_media tm
      JOIN public.editorial_articles a ON a.id = tm.article_id
      WHERE tm.media_id = m.id AND a.status = 'published'
        AND a.review_status = 'approved' AND a.reviewed_by IS NOT NULL
        AND a.reviewed_at IS NOT NULL AND a.published_at <= now()
    )
  );

REVOKE ALL ON public.public_media_assets FROM PUBLIC;
GRANT SELECT ON public.public_media_assets TO factsport_v2_reader;

COMMIT;
