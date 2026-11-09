-- VOD/clip assets use Cloudflare Stream, separate from R2 still images and
-- StreamIO live broadcast rooms. Upload and playback remain disabled until the
-- Stream API token, signing key, allowed origins and explicit readiness flag exist.
BEGIN;

CREATE TABLE IF NOT EXISTS public.media_video_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'cloudflare_stream'
    CHECK (provider='cloudflare_stream'),
  provider_video_id varchar(32) NOT NULL UNIQUE,
  title varchar(200) NOT NULL,
  description text,
  upload_status text NOT NULL DEFAULT 'pending_upload'
    CHECK (upload_status IN ('pending_upload','processing','ready','failed','rejected')),
  upload_expires_at timestamptz,
  duration_seconds numeric(10,3),
  width integer CHECK (width IS NULL OR width BETWEEN 1 AND 16384),
  height integer CHECK (height IS NULL OR height BETWEEN 1 AND 16384),
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  thumbnail_url text,
  playback_host varchar(255),
  ready_at timestamptz,
  rights_status text NOT NULL DEFAULT 'pending'
    CHECK (rights_status IN ('pending','owned','licensed','editorial_exception','rejected','expired')),
  rights_reference text,
  attribution_text text,
  usage_expires_at timestamptz,
  rights_reviewed_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  rights_reviewed_at timestamptz,
  is_public boolean NOT NULL DEFAULT false,
  uploaded_by uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_video_rights_review_pair CHECK (
    (rights_reviewed_by IS NULL AND rights_reviewed_at IS NULL) OR
    (rights_reviewed_by IS NOT NULL AND rights_reviewed_at IS NOT NULL)
  ),
  CONSTRAINT media_video_public_requires_ready_rights CHECK (
    NOT is_public OR (
      upload_status='ready'
      AND rights_status IN ('owned','licensed','editorial_exception')
      AND rights_reviewed_by IS NOT NULL AND rights_reviewed_at IS NOT NULL
      AND (usage_expires_at IS NULL OR usage_expires_at > now())
      AND playback_host IS NOT NULL
    )
  ),
  CONSTRAINT media_video_expiry_future CHECK (
    usage_expires_at IS NULL OR usage_expires_at > created_at
  )
);

CREATE INDEX IF NOT EXISTS media_video_assets_status_idx
  ON public.media_video_assets (upload_status, created_at DESC);
CREATE INDEX IF NOT EXISTS media_video_assets_rights_idx
  ON public.media_video_assets (rights_status, usage_expires_at);

CREATE TABLE IF NOT EXISTS public.editorial_article_revision_videos (
  revision_id uuid NOT NULL REFERENCES public.editorial_article_revisions(id) ON DELETE RESTRICT,
  position integer NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 100),
  video_id uuid REFERENCES public.media_video_assets(id) ON DELETE RESTRICT,
  remove_video boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (revision_id, position),
  CONSTRAINT editorial_revision_video_action CHECK (
    (video_id IS NOT NULL AND remove_video=false) OR
    (video_id IS NULL AND remove_video=true)
  )
);

CREATE TABLE IF NOT EXISTS public.editorial_article_videos (
  article_id uuid NOT NULL REFERENCES public.editorial_articles(id) ON DELETE RESTRICT,
  position integer NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 100),
  video_id uuid NOT NULL REFERENCES public.media_video_assets(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, position),
  UNIQUE (article_id, video_id)
);

REVOKE ALL ON public.media_video_assets,
  public.editorial_article_revision_videos,
  public.editorial_article_videos
FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer,
     factsport_v2_espn_writer, factsport_v2_social_dispatcher,
     factsport_v2_media_automation_writer;

GRANT SELECT, INSERT ON public.media_video_assets TO factsport_v2_editorial_writer;
GRANT UPDATE (
  upload_status, duration_seconds, width, height, size_bytes,
  thumbnail_url, playback_host, ready_at, rights_status, rights_reference,
  attribution_text, usage_expires_at, rights_reviewed_by, rights_reviewed_at,
  is_public, updated_at
) ON public.media_video_assets TO factsport_v2_editorial_writer;
GRANT SELECT, INSERT, UPDATE ON public.editorial_article_revision_videos
  TO factsport_v2_editorial_writer;
GRANT SELECT, INSERT, DELETE ON public.editorial_article_videos
  TO factsport_v2_editorial_writer;

ALTER TABLE public.media_editorial_audit_events
  DROP CONSTRAINT IF EXISTS media_editorial_audit_events_action_check,
  ADD CONSTRAINT media_editorial_audit_events_action_check CHECK (action IN (
    'draft_saved', 'submitted_for_review', 'review_approved', 'review_rejected',
    'published', 'archived', 'media_uploaded', 'media_rights_reviewed',
    'media_detached', 'media_derivative_created', 'media_rights_revoked',
    'media_video_upload_started', 'media_video_uploaded', 'media_video_rights_reviewed', 'media_video_attached',
    'source_added', 'social_scheduled', 'social_cancelled',
    'social_channel_configured', 'membership_granted', 'membership_revoked'
  ));

CREATE OR REPLACE VIEW public.public_editorial_article_videos AS
SELECT
  a.id AS article_id,
  v.id AS video_id,
  v.title,
  v.description,
  v.duration_seconds,
  v.width,
  v.height,
  v.thumbnail_url,
  v.playback_host,
  av.position
FROM public.editorial_article_videos av
JOIN public.editorial_articles a ON a.id=av.article_id
JOIN public.media_video_assets v ON v.id=av.video_id
WHERE a.status='published'
  AND a.review_status='approved'
  AND a.reviewed_by IS NOT NULL
  AND a.reviewed_at IS NOT NULL
  AND a.published_at <= now()
  AND v.upload_status='ready'
  AND v.is_public=true
  AND v.rights_status IN ('owned','licensed','editorial_exception')
  AND v.rights_reviewed_by IS NOT NULL
  AND v.rights_reviewed_at IS NOT NULL
  AND (v.usage_expires_at IS NULL OR v.usage_expires_at > now());

-- Token issuance reads the Stream UID only server-side; never serialize it into
-- the public article payload.
CREATE OR REPLACE VIEW public.public_editorial_article_video_tokens AS
SELECT a.id AS article_id, v.id AS video_id, v.provider_video_id, v.playback_host
FROM public.editorial_article_videos av
JOIN public.editorial_articles a ON a.id=av.article_id
JOIN public.media_video_assets v ON v.id=av.video_id
WHERE a.status='published'
  AND a.review_status='approved'
  AND a.reviewed_by IS NOT NULL
  AND a.reviewed_at IS NOT NULL
  AND a.published_at <= now()
  AND v.upload_status='ready'
  AND v.is_public=true
  AND v.rights_status IN ('owned','licensed','editorial_exception')
  AND v.rights_reviewed_by IS NOT NULL
  AND v.rights_reviewed_at IS NOT NULL
  AND (v.usage_expires_at IS NULL OR v.usage_expires_at > now());

REVOKE ALL ON public.public_editorial_article_videos,
  public.public_editorial_article_video_tokens FROM PUBLIC;
GRANT SELECT ON public.public_editorial_article_videos,
  public.public_editorial_article_video_tokens TO factsport_v2_reader;

COMMIT;
