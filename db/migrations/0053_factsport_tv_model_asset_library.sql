-- Private reusable GLB model intake for Factsport TV; all submissions start rights-pending.
-- This adds a library and episode links without enabling rendering or public access.
BEGIN;

CREATE TABLE IF NOT EXISTS public.factsport_tv_asset_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_kind text NOT NULL CHECK (asset_kind IN ('stadium_environment', 'generic_player', 'football')),
  object_key text NOT NULL UNIQUE
    CHECK (object_key LIKE 'tv/models/%' AND char_length(object_key) <= 1024),
  content_type text NOT NULL DEFAULT 'model/gltf-binary'
    CHECK (content_type = 'model/gltf-binary'),
  byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 33554432),
  sha256 text NOT NULL UNIQUE CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  rights_status text NOT NULL DEFAULT 'pending'
    CHECK (rights_status IN ('pending', 'cleared', 'restricted', 'revoked')),
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(provenance) = 'object'),
  created_by uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS factsport_tv_asset_library_review_idx
  ON public.factsport_tv_asset_library (rights_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.factsport_tv_episode_asset_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.factsport_tv_episodes(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES public.factsport_tv_asset_library(id) ON DELETE RESTRICT,
  usage_role text NOT NULL CHECK (usage_role IN ('stadium_environment', 'generic_player', 'football')),
  created_by uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (episode_id, asset_id, usage_role)
);
CREATE INDEX IF NOT EXISTS factsport_tv_episode_asset_links_episode_idx
  ON public.factsport_tv_episode_asset_links (episode_id, usage_role, created_at DESC);

ALTER TABLE public.factsport_tv_audit_events
  DROP CONSTRAINT IF EXISTS factsport_tv_audit_events_action_check;
ALTER TABLE public.factsport_tv_audit_events
  ADD CONSTRAINT factsport_tv_audit_events_action_check CHECK (action IN (
    'episode_created', 'facts_validated', 'script_saved', 'scene_saved',
    'render_requested', 'render_started', 'render_completed', 'render_failed',
    'approval_recorded', 'publish_queued', 'publish_attempted',
    'published', 'cancelled', 'retracted', 'rights_changed',
    'asset_uploaded', 'asset_linked'
  ));

REVOKE ALL ON public.factsport_tv_asset_library, public.factsport_tv_episode_asset_links
  FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer,
    factsport_v2_espn_writer, factsport_v2_media_automation_writer,
    factsport_v2_social_dispatcher;
GRANT USAGE ON SCHEMA public TO factsport_v2_editorial_writer;
GRANT SELECT, INSERT, UPDATE ON public.factsport_tv_asset_library
  TO factsport_v2_editorial_writer;
GRANT SELECT, INSERT ON public.factsport_tv_episode_asset_links
  TO factsport_v2_editorial_writer;
GRANT SELECT, INSERT ON public.factsport_tv_audit_events
  TO factsport_v2_editorial_writer;

COMMIT;
