-- Factsport V2 Media social publishing foundation.
-- Additive and isolated to factsport_v2. No legacy rows are copied or deleted.
-- Editorial articles and social publications remain separate records and lifecycles.
BEGIN;

CREATE TABLE IF NOT EXISTS public.media_social_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  provider text NOT NULL,
  account_label text,
  is_enabled boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(settings) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_channel_key_format CHECK (channel_key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  CONSTRAINT social_channel_provider_format CHECK (provider ~ '^[a-z0-9][a-z0-9_-]{1,63}$')
);

CREATE TABLE IF NOT EXISTS public.media_social_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES public.editorial_articles(id) ON DELETE SET NULL,
  channel_id uuid NOT NULL REFERENCES public.media_social_channels(id) ON DELETE RESTRICT,
  content_text text NOT NULL,
  media_asset_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  link_url text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'queued', 'publishing', 'published', 'failed', 'cancelled')),
  scheduled_at timestamptz,
  published_at timestamptz,
  provider_post_id text,
  provider_post_url text,
  idempotency_key text NOT NULL UNIQUE,
  created_by uuid,
  updated_by uuid,
  last_error_code text,
  last_error_message text,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_publication_content_length CHECK (char_length(content_text) BETWEEN 1 AND 10000),
  CONSTRAINT social_publication_link_length CHECK (link_url IS NULL OR char_length(link_url) <= 2048),
  CONSTRAINT social_publication_schedule CHECK (
    (status <> 'scheduled' OR scheduled_at IS NOT NULL)
  ),
  CONSTRAINT social_publication_published CHECK (
    (status <> 'published' OR published_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS media_social_publications_due_idx
  ON public.media_social_publications (scheduled_at, created_at)
  WHERE status IN ('scheduled', 'queued');
CREATE INDEX IF NOT EXISTS media_social_publications_article_idx
  ON public.media_social_publications (article_id, created_at DESC);
CREATE INDEX IF NOT EXISTS media_social_publications_channel_status_idx
  ON public.media_social_publications (channel_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.media_social_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL
    REFERENCES public.media_social_publications(id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  outcome text NOT NULL CHECK (outcome IN ('started', 'succeeded', 'retryable_failure', 'permanent_failure')),
  provider_request_id text,
  provider_post_id text,
  provider_response jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(provider_response) = 'object'),
  error_code text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (publication_id, attempt_number)
);
CREATE INDEX IF NOT EXISTS media_social_delivery_attempts_publication_idx
  ON public.media_social_delivery_attempts (publication_id, attempt_number DESC);

-- A separate durable outbox gives publishers an idempotent claim surface.
-- Provider credentials are deliberately not stored in these tables.
CREATE TABLE IF NOT EXISTS public.media_social_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL UNIQUE
    REFERENCES public.media_social_publications(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'retry', 'dead_letter', 'cancelled')),
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  lease_owner text,
  lease_expires_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_outbox_lease_pair CHECK (
    (lease_owner IS NULL AND lease_expires_at IS NULL) OR
    (lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS media_social_outbox_claim_idx
  ON public.media_social_outbox (available_at, created_at)
  WHERE status IN ('pending', 'retry');

-- These tables are private. Only the trusted server runtime should operate
-- on them; public readers receive no direct access to credentials or queues.
REVOKE ALL ON public.media_social_channels,
  public.media_social_publications,
  public.media_social_delivery_attempts,
  public.media_social_outbox
FROM PUBLIC, factsport_v2_reader;

COMMIT;
