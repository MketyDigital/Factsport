-- Factsport TV private episode workflow, durable render queue and publication outbox.
-- Apply only to the isolated Factsport V2 staging database after reviewing the
-- TV rights, access and retention model. This migration does not enable jobs or uploads.
BEGIN;

CREATE TABLE IF NOT EXISTS public.factsport_tv_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_format text NOT NULL CHECK (show_format IN (
    'match_story', 'factsport_daily', 'weekend_review', 'team_of_week'
  )),
  match_id uuid REFERENCES public.matches(id) ON DELETE RESTRICT,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  source_digest text NOT NULL CHECK (source_digest ~ '^[a-f0-9]{64}$'),
  idempotency_key text NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 1 AND 300),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN (
    'proposed', 'input_ready', 'facts_validated', 'script_draft',
    'editorial_review', 'storyboard_ready', 'render_queued', 'rendering',
    'rendered', 'qa_review', 'approved', 'publish_queued', 'published',
    'failed', 'blocked_rights', 'needs_data', 'revision_requested',
    'cancelled', 'retracted'
  )),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  editorial_content jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(editorial_content) = 'object'),
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 1 AND 3600),
  created_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (show_format, match_id, source_digest, revision),
  CHECK ((show_format = 'match_story' AND match_id IS NOT NULL) OR
         (show_format <> 'match_story'))
);
CREATE INDEX IF NOT EXISTS factsport_tv_episodes_status_idx
  ON public.factsport_tv_episodes (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS factsport_tv_episodes_match_idx
  ON public.factsport_tv_episodes (match_id, revision DESC)
  WHERE match_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.factsport_tv_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.factsport_tv_episodes(id) ON DELETE RESTRICT,
  scene_key text NOT NULL CHECK (char_length(scene_key) BETWEEN 1 AND 100),
  position integer NOT NULL CHECK (position >= 0),
  scene jsonb NOT NULL CHECK (jsonb_typeof(scene) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (episode_id, scene_key),
  UNIQUE (episode_id, position)
);

CREATE TABLE IF NOT EXISTS public.factsport_tv_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.factsport_tv_episodes(id) ON DELETE RESTRICT,
  object_key text NOT NULL CHECK (object_key LIKE 'tv/%' AND char_length(object_key) <= 1024),
  asset_kind text NOT NULL CHECK (asset_kind IN (
    'snapshot', 'scene_frame', 'audio', 'caption', 'poster', 'video', 'manifest'
  )),
  content_type text NOT NULL CHECK (char_length(content_type) BETWEEN 1 AND 160),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  rights_status text NOT NULL DEFAULT 'pending'
    CHECK (rights_status IN ('pending', 'cleared', 'restricted', 'revoked')),
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(provenance) = 'object'),
  created_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (object_key),
  UNIQUE (episode_id, sha256, asset_kind)
);
CREATE INDEX IF NOT EXISTS factsport_tv_assets_episode_idx
  ON public.factsport_tv_assets (episode_id, asset_kind, created_at);

CREATE TABLE IF NOT EXISTS public.factsport_tv_render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.factsport_tv_episodes(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 1 AND 300),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'retry', 'completed', 'dead_letter', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_owner text,
  lease_expires_at timestamptz,
  input_digest text NOT NULL CHECK (input_digest ~ '^[a-f0-9]{64}$'),
  output_manifest jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(output_manifest) = 'object'),
  last_error_code text,
  last_error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT factsport_tv_render_lease_pair CHECK (
    (lease_owner IS NULL AND lease_expires_at IS NULL) OR
    (lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS factsport_tv_render_claim_idx
  ON public.factsport_tv_render_jobs (available_at, created_at)
  WHERE status IN ('pending', 'retry');
CREATE INDEX IF NOT EXISTS factsport_tv_render_episode_idx
  ON public.factsport_tv_render_jobs (episode_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.factsport_tv_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.factsport_tv_episodes(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  gate text NOT NULL CHECK (gate IN ('facts', 'editorial', 'render_qa', 'rights', 'publish')),
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected', 'changes_requested')),
  actor_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 4000),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS factsport_tv_approvals_episode_idx
  ON public.factsport_tv_approvals (episode_id, revision, gate, created_at DESC);

CREATE TABLE IF NOT EXISTS public.factsport_tv_publish_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.factsport_tv_episodes(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  platform text NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'instagram', 'facebook')),
  idempotency_key text NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 1 AND 300),
  package jsonb NOT NULL CHECK (jsonb_typeof(package) = 'object'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'retry', 'completed', 'dead_letter', 'cancelled')),
  approved_by uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  approved_at timestamptz NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  lease_owner text,
  lease_expires_at timestamptz,
  provider_request_id text,
  provider_post_id text,
  provider_post_url text CHECK (provider_post_url IS NULL OR provider_post_url ~ '^https?://'),
  last_error_code text,
  last_error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (episode_id, revision, platform),
  CONSTRAINT factsport_tv_publish_lease_pair CHECK (
    (lease_owner IS NULL AND lease_expires_at IS NULL) OR
    (lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS factsport_tv_publish_claim_idx
  ON public.factsport_tv_publish_outbox (available_at, created_at)
  WHERE status IN ('pending', 'retry');

CREATE TABLE IF NOT EXISTS public.factsport_tv_publish_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id uuid NOT NULL REFERENCES public.factsport_tv_publish_outbox(id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  outcome text NOT NULL CHECK (outcome IN (
    'started', 'succeeded', 'retryable_failure', 'permanent_failure', 'unknown_result'
  )),
  provider_request_id text,
  provider_post_id text,
  error_code text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (outbox_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS public.factsport_tv_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid REFERENCES public.factsport_tv_episodes(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN (
    'episode_created', 'facts_validated', 'script_saved', 'scene_saved',
    'render_requested', 'render_started', 'render_completed', 'render_failed',
    'approval_recorded', 'publish_queued', 'publish_attempted',
    'published', 'cancelled', 'retracted', 'rights_changed'
  )),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS factsport_tv_audit_episode_idx
  ON public.factsport_tv_audit_events (episode_id, created_at DESC);

REVOKE ALL ON public.factsport_tv_episodes, public.factsport_tv_scenes,
  public.factsport_tv_assets, public.factsport_tv_render_jobs,
  public.factsport_tv_approvals, public.factsport_tv_publish_outbox,
  public.factsport_tv_publish_attempts, public.factsport_tv_audit_events
FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer,
  factsport_v2_espn_writer, factsport_v2_media_automation_writer,
  factsport_v2_social_dispatcher;

-- Existing Entra-backed Media editor authorization remains the human gate.
-- The app writer can manage drafts and audit records, but the DB migration
-- does not create jobs, approve posts, store credentials or enable schedules.
GRANT USAGE ON SCHEMA public TO factsport_v2_editorial_writer;
GRANT SELECT, INSERT, UPDATE ON public.factsport_tv_episodes,
  public.factsport_tv_scenes, public.factsport_tv_assets,
  public.factsport_tv_render_jobs, public.factsport_tv_approvals,
  public.factsport_tv_publish_outbox
TO factsport_v2_editorial_writer;
GRANT SELECT, INSERT ON public.factsport_tv_audit_events
TO factsport_v2_editorial_writer;

-- A dispatcher can reconcile approved outbox records without seeing or
-- modifying episode drafts, source snapshots, editorial scripts or approvals.
GRANT USAGE ON SCHEMA public TO factsport_v2_social_dispatcher;
GRANT SELECT, UPDATE ON public.factsport_tv_publish_outbox
TO factsport_v2_social_dispatcher;
GRANT SELECT, INSERT ON public.factsport_tv_publish_attempts
TO factsport_v2_social_dispatcher;
GRANT SELECT, INSERT ON public.factsport_tv_audit_events
TO factsport_v2_social_dispatcher;

COMMIT;
