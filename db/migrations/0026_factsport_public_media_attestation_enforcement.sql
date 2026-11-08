-- Enforce public Media attestations at the database boundary.
-- Run after 0022 and 0023. Existing queued/published social rows and published
-- revisions must be reconciled by an authorized operator before this migration
-- can validate the constraints. No row is silently approved or rewritten.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.media_social_publications
    WHERE status IN ('scheduled', 'queued', 'publishing', 'published')
      AND (
        distribution_scope <> 'public_media'
        OR public_content_confirmed_by IS NULL
        OR public_content_confirmed_at IS NULL
      )
  ) THEN
    RAISE EXCEPTION
      'MEDIA_ATTESTATION_RECONCILIATION_REQUIRED: reconcile scheduled/queued/publishing/published social publications before applying migration 0026';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.editorial_article_revisions
    WHERE workflow_status = 'published'
      AND (
        public_media_policy_confirmed_by IS NULL
        OR public_media_policy_confirmed_at IS NULL
        OR public_media_policy_version IS NULL
      )
  ) THEN
    RAISE EXCEPTION
      'EDITORIAL_ATTESTATION_RECONCILIATION_REQUIRED: review or retire published revisions without a publisher policy attestation before applying migration 0026';
  END IF;
END
$$;

ALTER TABLE public.media_social_publications
  VALIDATE CONSTRAINT media_social_publications_public_delivery_requires_confirmation;

ALTER TABLE public.editorial_article_revisions
  DROP CONSTRAINT IF EXISTS editorial_revision_published_requires_public_media_attestation,
  ADD CONSTRAINT editorial_revision_published_requires_public_media_attestation
    CHECK (
      workflow_status <> 'published'
      OR (
        public_media_policy_confirmed_by IS NOT NULL
        AND public_media_policy_confirmed_at IS NOT NULL
        AND public_media_policy_version IS NOT NULL
      )
    ) NOT VALID;

ALTER TABLE public.editorial_article_revisions
  VALIDATE CONSTRAINT editorial_revision_published_requires_public_media_attestation;

COMMIT;
