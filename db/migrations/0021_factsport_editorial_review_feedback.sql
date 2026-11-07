-- Editorial review feedback and explicit rejection/change-request state.
BEGIN;

ALTER TABLE public.editorial_article_revisions
  ADD COLUMN IF NOT EXISTS review_comment text,
  ADD CONSTRAINT editorial_revision_review_comment_length
    CHECK (review_comment IS NULL OR char_length(review_comment) <= 2000);

ALTER TABLE public.media_editorial_audit_events
  DROP CONSTRAINT IF EXISTS media_editorial_audit_events_action_check,
  ADD CONSTRAINT media_editorial_audit_events_action_check CHECK (action IN (
    'draft_saved', 'submitted_for_review', 'review_approved', 'review_rejected',
    'published', 'archived', 'media_uploaded', 'media_rights_reviewed',
    'social_scheduled', 'social_cancelled',
    'membership_granted', 'membership_revoked'
  ));

COMMIT;
