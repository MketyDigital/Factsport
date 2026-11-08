-- Durable Stream token identity mapping and idempotent webhook receipt ledger.
-- This enables participant/audit reconciliation without storing user tokens or raw invite values.
BEGIN;

CREATE TABLE IF NOT EXISTS public.media_broadcast_token_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.media_broadcast_rooms(id) ON DELETE RESTRICT,
  stream_user_id text NOT NULL CHECK (char_length(stream_user_id) BETWEEN 1 AND 160),
  identity_kind text NOT NULL CHECK (identity_kind IN ('anonymous', 'authenticated', 'guest')),
  user_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  role_key text NOT NULL CHECK (role_key IN ('listener', 'caller', 'guest', 'host', 'moderator')),
  invite_id uuid REFERENCES public.media_broadcast_invites(id) ON DELETE RESTRICT,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK ((identity_kind = 'guest' AND invite_id IS NOT NULL) OR (identity_kind <> 'guest' AND invite_id IS NULL)),
  UNIQUE (room_id, stream_user_id)
);
CREATE INDEX IF NOT EXISTS media_broadcast_token_identities_invite_idx
  ON public.media_broadcast_token_identities (invite_id, issued_at DESC)
  WHERE invite_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS media_broadcast_token_identities_active_idx
  ON public.media_broadcast_token_identities (room_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.media_broadcast_webhook_events (
  webhook_id text PRIMARY KEY CHECK (char_length(webhook_id) BETWEEN 1 AND 160),
  event_type text NOT NULL CHECK (char_length(event_type) BETWEEN 1 AND 160),
  call_cid text,
  stream_user_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS media_broadcast_webhook_events_received_idx
  ON public.media_broadcast_webhook_events (received_at DESC);

ALTER TABLE public.media_broadcast_audit_events
  DROP CONSTRAINT IF EXISTS media_broadcast_audit_events_action_check,
  ADD CONSTRAINT media_broadcast_audit_events_action_check
    CHECK (action IN (
      'room_created', 'room_activated', 'room_shutdown', 'settings_updated',
      'role_granted', 'role_revoked', 'invite_created', 'invite_revoked',
      'guest_admitted', 'participant_joined', 'participant_left',
      'callin_requested', 'mic_granted', 'mic_revoked', 'participant_removed',
      'broadcast_live_started', 'broadcast_live_stopped',
      'recording_started', 'recording_stopped'
    ));

REVOKE ALL ON public.media_broadcast_token_identities,
  public.media_broadcast_webhook_events
  FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer,
       factsport_v2_espn_writer, factsport_v2_editorial_writer;

GRANT SELECT, INSERT, UPDATE ON public.media_broadcast_token_identities
  TO factsport_v2_broadcast_token_issuer, factsport_v2_media_broadcast_admin;
GRANT SELECT, INSERT, UPDATE ON public.media_broadcast_webhook_events
  TO factsport_v2_broadcast_token_issuer;

COMMIT;
