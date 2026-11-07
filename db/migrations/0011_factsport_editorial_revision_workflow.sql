-- Versioned editorial review workflow.
-- A published article remains publicly visible while an edited revision is reviewed.
-- Apply after 0005 on the isolated factsport_v2 database.
BEGIN;

ALTER TABLE public.editorial_article_revisions
  ADD COLUMN IF NOT EXISTS workflow_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

ALTER TABLE public.editorial_article_revisions
  DROP CONSTRAINT IF EXISTS editorial_revision_workflow_status_valid,
  ADD CONSTRAINT editorial_revision_workflow_status_valid
    CHECK (workflow_status IN ('draft', 'in_review', 'approved', 'published', 'rejected', 'superseded')),
  DROP CONSTRAINT IF EXISTS editorial_revision_review_timestamps,
  ADD CONSTRAINT editorial_revision_review_timestamps CHECK (
    (workflow_status NOT IN ('in_review', 'approved', 'published') OR
      (submitted_by IS NOT NULL AND submitted_at IS NOT NULL))
    AND
    (workflow_status NOT IN ('approved', 'published') OR
      (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
    AND
    (workflow_status <> 'published' OR published_at IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS editorial_revision_workflow_idx
  ON public.editorial_article_revisions (article_id, workflow_status, revision_number DESC);

COMMIT;
