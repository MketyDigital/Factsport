-- Durable Media match-event outbox and per-channel delivery ledger.
-- Create factsport_v2_media_automation_writer and factsport_v2_social_dispatcher
-- separately with NOINHERIT/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS.
-- Provider credentials are injected only as Cloudflare secrets; never stored here.
BEGIN;

CREATE TABLE IF NOT EXISTS public.media_social_match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN (
    'goals', 'lineups', 'kickoff', 'fulltime', 'halftime',
    'var_overturn', 'penalty_awarded'
  )),
  event_key text NOT NULL CHECK (char_length(event_key) BETWEEN 1 AND 300),
  dedupe_key text NOT NULL UNIQUE CHECK (char_length(dedupe_key) <= 512),
  match_version integer CHECK (match_version IS NULL OR match_version >= 0),
  event_payload jsonb NOT NULL CHECK (jsonb_typeof(event_payload) = 'object'),
  policy_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(policy_snapshot) = 'object'),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'partial', 'failed', 'cancelled')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, event_key)
);
CREATE INDEX IF NOT EXISTS media_social_match_events_match_idx
  ON public.media_social_match_events (match_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS media_social_match_events_status_idx
  ON public.media_social_match_events (status, detected_at);

CREATE TABLE IF NOT EXISTS public.media_social_match_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.media_social_match_events(id) ON DELETE RESTRICT,
  channel_id uuid NOT NULL REFERENCES public.media_social_channels(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'retry', 'completed', 'dead_letter', 'skipped', 'cancelled')),
  content_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(content_snapshot) = 'object'),
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  lease_owner text,
  lease_expires_at timestamptz,
  provider_request_id text,
  provider_post_id text,
  provider_post_url text,
  last_error_code text,
  last_error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, channel_id),
  CONSTRAINT social_match_delivery_lease_pair CHECK (
    (lease_owner IS NULL AND lease_expires_at IS NULL) OR
    (lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
  ),
  CONSTRAINT social_match_delivery_url_protocol CHECK (
    provider_post_url IS NULL OR provider_post_url ~ '^https?://'
  )
);
CREATE INDEX IF NOT EXISTS media_social_match_deliveries_claim_idx
  ON public.media_social_match_deliveries (available_at, created_at)
  WHERE status IN ('pending', 'retry');
CREATE INDEX IF NOT EXISTS media_social_match_deliveries_event_idx
  ON public.media_social_match_deliveries (event_id, status);

CREATE TABLE IF NOT EXISTS public.media_social_match_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL
    REFERENCES public.media_social_match_deliveries(id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  outcome text NOT NULL CHECK (outcome IN (
    'started', 'succeeded', 'retryable_failure', 'permanent_failure', 'unknown_result'
  )),
  provider_request_id text,
  provider_post_id text,
  provider_response jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(provider_response) = 'object'),
  error_code text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (delivery_id, attempt_number)
);
CREATE INDEX IF NOT EXISTS media_social_match_attempts_delivery_idx
  ON public.media_social_match_delivery_attempts (delivery_id, attempt_number DESC);

-- No direct access for browser/public or unrelated runtime identities.
REVOKE ALL ON public.media_social_match_events,
  public.media_social_match_deliveries,
  public.media_social_match_delivery_attempts
FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer,
  factsport_v2_espn_writer, factsport_v2_editorial_writer;

-- Match ingestion/event detection may read canonical match snapshots and Media
-- policy, then create event + channel delivery snapshots. It cannot call providers.
GRANT USAGE ON SCHEMA public TO factsport_v2_media_automation_writer;
GRANT SELECT ON public.matches, public.media_social_channels,
  public.media_social_automation_settings, public.media_social_event_routes,
  public.media_social_event_templates, public.media_social_vip_teams,
  public.media_social_vip_leagues
TO factsport_v2_media_automation_writer;
GRANT SELECT, INSERT ON public.media_social_match_events,
  public.media_social_match_deliveries
TO factsport_v2_media_automation_writer;

-- Provider dispatcher has no match-table, editorial-article, prediction or
-- settlement access. It can claim/update delivery work and record attempts.
GRANT USAGE ON SCHEMA public TO factsport_v2_social_dispatcher;
GRANT SELECT ON public.media_social_channels,
  public.media_social_publications, public.media_social_outbox,
  public.media_social_match_events
TO factsport_v2_social_dispatcher;
GRANT SELECT, UPDATE ON public.media_social_outbox,
  public.media_social_match_events, public.media_social_match_deliveries,
  public.media_social_publications
TO factsport_v2_social_dispatcher;
GRANT SELECT, INSERT ON public.media_social_match_delivery_attempts,
  public.media_social_delivery_attempts
TO factsport_v2_social_dispatcher;
GRANT SELECT, UPDATE ON public.media_social_match_deliveries
TO factsport_v2_social_dispatcher;

COMMIT;
