-- Least-privilege public media projection and receipt updates for the social dispatcher.
-- This does not enable a scheduler, provider credentials or live delivery.
BEGIN;

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

REVOKE ALL ON public.public_social_media_assets
  FROM PUBLIC, factsport_v2_reader, factsport_v2_editorial_writer,
       factsport_v2_schedule_writer, factsport_v2_espn_writer;
GRANT SELECT ON public.public_social_media_assets TO factsport_v2_social_dispatcher;

ALTER TABLE public.media_social_delivery_attempts
  DROP CONSTRAINT IF EXISTS media_social_delivery_attempts_outcome_check,
  ADD CONSTRAINT media_social_delivery_attempts_outcome_check
    CHECK (outcome IN ('started','succeeded','retryable_failure','permanent_failure','unknown_result'));

GRANT UPDATE (
  outcome, provider_request_id, provider_post_id, provider_response,
  error_code, error_message, finished_at
) ON public.media_social_delivery_attempts TO factsport_v2_social_dispatcher;

COMMIT;
