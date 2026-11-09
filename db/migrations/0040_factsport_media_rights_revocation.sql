-- Explicit, auditable Media rights withdrawal. The source object is retained;
-- public projections immediately fail closed through rights_status/is_public.
BEGIN;

ALTER TABLE public.media_editorial_audit_events
  DROP CONSTRAINT IF EXISTS media_editorial_audit_events_action_check,
  ADD CONSTRAINT media_editorial_audit_events_action_check CHECK (action IN (
    'draft_saved', 'submitted_for_review', 'review_approved', 'review_rejected',
    'published', 'archived', 'media_uploaded', 'media_rights_reviewed',
    'media_detached', 'media_derivative_created', 'media_rights_revoked',
    'source_added', 'social_scheduled', 'social_cancelled',
    'social_channel_configured', 'membership_granted', 'membership_revoked'
  ));

COMMIT;
