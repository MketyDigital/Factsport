-- Private operator reconciliation surface for ambiguous social provider deliveries.
-- Only explicit, evidence-backed decisions can close or requeue unknown_result posts.
BEGIN;

CREATE OR REPLACE VIEW public.media_social_operator_reconciliation
WITH (security_barrier = true) AS
SELECT
  p.id AS publication_id,
  p.content_text,
  p.status AS publication_status,
  p.scheduled_at,
  p.provider_post_id AS publication_provider_post_id,
  p.provider_post_url,
  p.last_error_code AS publication_error_code,
  p.last_error_message AS publication_error_message,
  c.display_name,
  c.provider,
  o.id AS outbox_id,
  o.status AS outbox_status,
  o.attempts,
  o.last_error_code AS outbox_error_code,
  latest.attempt_number,
  latest.outcome,
  latest.provider_request_id,
  latest.provider_post_id AS attempt_provider_post_id,
  latest.provider_response,
  latest.error_code AS attempt_error_code,
  latest.error_message AS attempt_error_message,
  latest.started_at,
  latest.finished_at
FROM public.media_social_publications p
JOIN public.media_social_channels c ON c.id = p.channel_id
JOIN public.media_social_outbox o ON o.publication_id = p.id
JOIN LATERAL (
  SELECT
    a.attempt_number,
    a.outcome,
    a.provider_request_id,
    a.provider_post_id,
    a.provider_response,
    a.error_code,
    a.error_message,
    a.started_at,
    a.finished_at
  FROM public.media_social_delivery_attempts a
  WHERE a.publication_id = p.id
  ORDER BY a.attempt_number DESC
  LIMIT 1
) latest ON true
WHERE o.status = 'dead_letter'
  AND latest.outcome = 'unknown_result';

COMMENT ON VIEW public.media_social_operator_reconciliation IS
  'Private, sanitized operator queue for ambiguous provider deliveries. No credentials or raw provider payloads.';

REVOKE ALL ON public.media_social_operator_reconciliation
  FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer,
       factsport_v2_espn_writer, factsport_v2_social_dispatcher;
GRANT SELECT ON public.media_social_operator_reconciliation
  TO factsport_v2_editorial_writer;

ALTER TABLE public.media_editorial_audit_events
  DROP CONSTRAINT IF EXISTS media_editorial_audit_events_action_check,
  ADD CONSTRAINT media_editorial_audit_events_action_check CHECK (action IN (
    'draft_saved', 'submitted_for_review', 'review_approved', 'review_rejected',
    'published', 'archived', 'media_uploaded', 'media_rights_reviewed',
    'media_detached', 'media_derivative_created', 'media_rights_revoked',
    'media_video_upload_started', 'media_video_uploaded', 'media_video_upload_failed',
    'media_video_rights_reviewed', 'media_video_rights_revoked',
    'media_video_attached', 'media_video_detached',
    'source_added', 'social_scheduled', 'social_cancelled',
    'social_channel_configured', 'social_delivery_reconciled_published',
    'social_delivery_requeued_after_no_post',
    'membership_granted', 'membership_revoked'
  ));

COMMIT;
