-- Public source references are published only with the approved article.
-- Rights-reference notes remain private and are intentionally excluded.
BEGIN;

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
WHERE a.status='published'
  AND a.review_status='approved'
  AND a.reviewed_by IS NOT NULL
  AND a.reviewed_at IS NOT NULL
  AND a.published_at <= now();

REVOKE ALL ON public.public_editorial_article_sources
  FROM PUBLIC, factsport_v2_editorial_writer,
       factsport_v2_schedule_writer, factsport_v2_espn_writer;
GRANT SELECT ON public.public_editorial_article_sources TO factsport_v2_reader;

COMMIT;
