-- Resumable private R2 multipart intake for large Factsport TV GLB models.
-- Uploads remain unpublished and rights-pending; this only persists intake state.
BEGIN;

ALTER TABLE public.factsport_tv_asset_library
  DROP CONSTRAINT IF EXISTS factsport_tv_asset_library_byte_size_check;
ALTER TABLE public.factsport_tv_asset_library
  ADD CONSTRAINT factsport_tv_asset_library_byte_size_check
  CHECK (byte_size BETWEEN 1 AND 536870912);

CREATE TABLE IF NOT EXISTS public.factsport_tv_model_upload_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  episode_id uuid REFERENCES public.factsport_tv_episodes(id) ON DELETE RESTRICT,
  asset_kind text NOT NULL CHECK (asset_kind IN ('stadium_environment', 'generic_player', 'football')),
  object_key text NOT NULL UNIQUE CHECK (object_key LIKE 'tv/models/%' AND char_length(object_key) <= 1024),
  r2_upload_id text NOT NULL UNIQUE CHECK (char_length(r2_upload_id) BETWEEN 1 AND 500),
  expected_size bigint NOT NULL CHECK (expected_size BETWEEN 20 AND 536870912),
  part_size integer NOT NULL CHECK (part_size = 16777216),
  expected_part_count integer NOT NULL CHECK (expected_part_count BETWEEN 1 AND 32),
  original_filename text NOT NULL CHECK (char_length(original_filename) BETWEEN 1 AND 180),
  provenance jsonb NOT NULL CHECK (jsonb_typeof(provenance) = 'object'),
  status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'completing', 'completed', 'aborted', 'failed')),
  asset_id uuid REFERENCES public.factsport_tv_asset_library(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '6 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'completed' AND asset_id IS NOT NULL) OR status <> 'completed')
);
CREATE INDEX IF NOT EXISTS factsport_tv_model_upload_sessions_owner_idx
  ON public.factsport_tv_model_upload_sessions (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS factsport_tv_model_upload_sessions_expiry_idx
  ON public.factsport_tv_model_upload_sessions (expires_at)
  WHERE status IN ('uploading', 'completing');

CREATE TABLE IF NOT EXISTS public.factsport_tv_model_upload_parts (
  session_id uuid NOT NULL REFERENCES public.factsport_tv_model_upload_sessions(id) ON DELETE RESTRICT,
  part_number integer NOT NULL CHECK (part_number BETWEEN 1 AND 32),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 16777216),
  etag text NOT NULL CHECK (char_length(etag) BETWEEN 1 AND 200),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, part_number)
);

REVOKE ALL ON public.factsport_tv_model_upload_sessions, public.factsport_tv_model_upload_parts
  FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer,
    factsport_v2_espn_writer, factsport_v2_media_automation_writer,
    factsport_v2_social_dispatcher;
GRANT SELECT, INSERT, UPDATE ON public.factsport_tv_model_upload_sessions
  TO factsport_v2_editorial_writer;
GRANT SELECT, INSERT, UPDATE ON public.factsport_tv_model_upload_parts
  TO factsport_v2_editorial_writer;
GRANT SELECT, INSERT ON public.factsport_tv_audit_events
  TO factsport_v2_editorial_writer;

COMMIT;
