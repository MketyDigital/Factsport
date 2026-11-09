-- Source provenance belongs to an immutable editorial revision, not the article shell.
-- This prevents sources added to an unpublished draft of an already-published article
-- from becoming public before the replacement revision is approved and published.
BEGIN;

ALTER TABLE public.editorial_article_sources
  ADD COLUMN IF NOT EXISTS revision_id uuid
    REFERENCES public.editorial_article_revisions(id) ON DELETE RESTRICT;

UPDATE public.editorial_article_sources s
SET revision_id = (
  SELECT r.id
  FROM public.editorial_article_revisions r
  WHERE r.article_id=s.article_id AND r.workflow_status='published'
  ORDER BY r.revision_number DESC
  LIMIT 1
)
WHERE s.revision_id IS NULL;

CREATE INDEX IF NOT EXISTS editorial_article_sources_revision_idx
  ON public.editorial_article_sources (revision_id, created_at DESC);

CREATE OR REPLACE VIEW public.public_editorial_article_sources AS
SELECT
  s.id,
  s.article_id,
  s.source_title,
  s.publisher,
  s.canonical_url,
  s.attribution_text,
  s.accessed_at
FROM public.editorial_article_sources s
JOIN public.editorial_articles a ON a.id=s.article_id
JOIN public.editorial_article_revisions r
  ON r.id=s.revision_id AND r.article_id=s.article_id
WHERE a.status='published'
  AND a.review_status='approved'
  AND a.reviewed_by IS NOT NULL
  AND a.reviewed_at IS NOT NULL
  AND a.published_at <= now()
  AND r.workflow_status='published'
  AND r.id = (
    SELECT latest.id
    FROM public.editorial_article_revisions latest
    WHERE latest.article_id=a.id AND latest.workflow_status='published'
    ORDER BY latest.revision_number DESC
    LIMIT 1
  )
  AND s.canonical_url ~* '^https?://'
  AND s.canonical_url !~* '^https?://[^/]*@';

REVOKE ALL ON public.public_editorial_article_sources
  FROM PUBLIC, factsport_v2_editorial_writer,
       factsport_v2_schedule_writer, factsport_v2_espn_writer;
GRANT SELECT ON public.public_editorial_article_sources TO factsport_v2_reader;

COMMIT;
