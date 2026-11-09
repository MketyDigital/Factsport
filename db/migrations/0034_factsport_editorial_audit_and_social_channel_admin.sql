-- Add audited editorial provenance/media actions and least-privilege social channel settings.
BEGIN;

ALTER TABLE public.media_editorial_audit_events
  DROP CONSTRAINT IF EXISTS media_editorial_audit_events_action_check,
  ADD CONSTRAINT media_editorial_audit_events_action_check CHECK (action IN (
    'draft_saved', 'submitted_for_review', 'review_approved', 'review_rejected',
    'published', 'archived', 'media_uploaded', 'media_rights_reviewed', 'media_detached',
    'source_added', 'social_scheduled', 'social_cancelled', 'social_channel_configured',
    'membership_granted', 'membership_revoked'
  ));

GRANT UPDATE (is_enabled, supports_media, settings, updated_at)
  ON public.media_social_channels TO factsport_v2_editorial_writer;

COMMIT;
