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

-- If an article has never been published, keep any existing source rows with its latest pending revision.
UPDATE public.editorial_article_sources s
SET revision_id = (
  SELECT r.id
  FROM public.editorial_article_revisions r
  WHERE r.article_id=s.article_id
    AND r.workflow_status IN ('draft','in_review','approved','rejected')
  ORDER BY r.revision_number DESC
  LIMIT 1
)
WHERE s.revision_id IS NULL;

-- Existing pending revisions inherit the article's previously published source list.
INSERT INTO public.editorial_article_sources
  (article_id, revision_id, source_title, publisher, canonical_url, attribution_text, rights_reference, accessed_at)
SELECT source.article_id, pending.id, source.source_title, source.publisher,
       source.canonical_url, source.attribution_text, source.rights_reference, source.accessed_at
FROM public.editorial_article_sources source
JOIN public.editorial_article_revisions published
  ON published.id=source.revision_id AND published.workflow_status='published'
JOIN LATERAL (
  SELECT id FROM public.editorial_article_revisions
  WHERE article_id=source.article_id AND workflow_status IN ('draft','in_review','approved','rejected')
  ORDER BY revision_number DESC LIMIT 1
) pending ON true
WHERE published.id = (
  SELECT latest.id FROM public.editorial_article_revisions latest
  WHERE latest.article_id=source.article_id AND latest.workflow_status='published'
  ORDER BY latest.revision_number DESC LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM public.editorial_article_sources existing
  WHERE existing.revision_id=pending.id
    AND existing.source_title=source.source_title
    AND existing.canonical_url=source.canonical_url
);

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
