-- Media-owned Global Goal Rush studio and room-scoped broadcast identity.
-- Broadcast access is independent of Prediction VIP/payment entitlements.
BEGIN;

CREATE TABLE IF NOT EXISTS public.media_broadcast_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key text NOT NULL UNIQUE CHECK (char_length(scope_key) <= 160),
  room_name text NOT NULL UNIQUE CHECK (room_name ~ '^[a-zA-Z0-9_-]{3,128}$'),
  scope_type text NOT NULL CHECK (scope_type IN ('global', 'match')),
  match_id uuid REFERENCES public.matches(id) ON DELETE RESTRICT,
  provider text NOT NULL DEFAULT 'stream' CHECK (provider IN ('stream')),
  is_active boolean NOT NULL DEFAULT false,
  public_listening_enabled boolean NOT NULL DEFAULT true,
  callin_enabled boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_broadcast_room_scope_match CHECK (
    (scope_type = 'global' AND match_id IS NULL AND scope_key = 'global-goal-rush' AND room_name = 'global-goal-rush')
    OR (scope_type = 'match' AND match_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS media_broadcast_one_room_per_match_idx
  ON public.media_broadcast_rooms (match_id) WHERE scope_type = 'match';

INSERT INTO public.media_broadcast_rooms
  (scope_key, room_name, scope_type, is_active, public_listening_enabled, callin_enabled)
VALUES ('global-goal-rush', 'global-goal-rush', 'global', false, true, false)
ON CONFLICT (scope_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.media_studio_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  room_id uuid NOT NULL REFERENCES public.media_broadcast_rooms(id) ON DELETE RESTRICT,
  title text NOT NULL DEFAULT 'Goal Rush Live' CHECK (char_length(title) BETWEEN 1 AND 160),
  audio_url text,
  video_url text,
  is_active boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_studio_audio_url_safe CHECK (
    audio_url IS NULL OR audio_url = 'streamio' OR
    (audio_url ~ '^https?://' AND audio_url !~ '^https?://[^/]*@')
  ),
  CONSTRAINT media_studio_video_url_safe CHECK (
    video_url IS NULL OR video_url = 'streamio' OR
    (video_url ~ '^https?://' AND video_url !~ '^https?://[^/]*@')
  )
);

INSERT INTO public.media_studio_settings (singleton, room_id)
SELECT true, id FROM public.media_broadcast_rooms WHERE scope_key = 'global-goal-rush'
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.media_broadcast_room_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.media_broadcast_rooms(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  role_key text NOT NULL CHECK (role_key IN ('host', 'moderator', 'caller')),
  granted_by uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id, role_key)
);
CREATE INDEX IF NOT EXISTS media_broadcast_room_roles_active_idx
  ON public.media_broadcast_room_roles (room_id, user_id, role_key)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.media_broadcast_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.media_broadcast_rooms(id) ON DELETE RESTRICT,
  token_hash char(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  invited_label text NOT NULL DEFAULT 'VIP Guest' CHECK (char_length(invited_label) <= 100),
  max_uses integer CHECK (max_uses IS NULL OR max_uses > 0),
  use_count integer NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  CONSTRAINT media_broadcast_invite_use_limit CHECK (max_uses IS NULL OR use_count <= max_uses)
);
CREATE INDEX IF NOT EXISTS media_broadcast_invites_room_idx
  ON public.media_broadcast_invites (room_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.media_broadcast_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.media_broadcast_rooms(id) ON DELETE RESTRICT,
  stream_user_id text NOT NULL CHECK (char_length(stream_user_id) BETWEEN 1 AND 160),
  user_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  identity_kind text NOT NULL CHECK (identity_kind IN ('anonymous', 'authenticated', 'guest')),
  role_key text NOT NULL DEFAULT 'listener'
    CHECK (role_key IN ('listener', 'caller', 'guest', 'host', 'moderator')),
  mic_enabled boolean NOT NULL DEFAULT false,
  mic_granted_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  UNIQUE (room_id, stream_user_id)
);
CREATE INDEX IF NOT EXISTS media_broadcast_participants_active_idx
  ON public.media_broadcast_participants (room_id, last_seen_at DESC)
  WHERE left_at IS NULL;

CREATE TABLE IF NOT EXISTS public.media_broadcast_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.media_broadcast_rooms(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  actor_kind text NOT NULL CHECK (actor_kind IN ('admin', 'participant', 'system')),
  action text NOT NULL CHECK (action IN (
    'room_activated', 'room_shutdown', 'invite_created', 'invite_revoked',
    'guest_admitted', 'participant_joined', 'participant_left',
    'callin_requested', 'mic_granted', 'mic_revoked', 'participant_removed'
  )),
  participant_id uuid REFERENCES public.media_broadcast_participants(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_broadcast_audit_room_idx
  ON public.media_broadcast_audit_events (room_id, created_at DESC);

CREATE OR REPLACE VIEW public.public_media_studio_settings AS
SELECT s.title, s.audio_url, s.video_url, s.is_active,
       r.room_name, r.public_listening_enabled, r.callin_enabled
FROM public.media_studio_settings s
JOIN public.media_broadcast_rooms r ON r.id = s.room_id
WHERE s.singleton = true AND r.is_active = true;

REVOKE ALL ON public.media_broadcast_rooms, public.media_studio_settings,
  public.media_broadcast_room_roles, public.media_broadcast_invites,
  public.media_broadcast_participants, public.media_broadcast_audit_events,
  public.public_media_studio_settings
FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer,
  factsport_v2_espn_writer, factsport_v2_editorial_writer;

GRANT SELECT ON public.public_media_studio_settings TO factsport_v2_reader;

-- Admin role: manage studio settings, room roles/invites and write audit events.
GRANT SELECT, INSERT, UPDATE ON public.media_broadcast_rooms,
  public.media_studio_settings, public.media_broadcast_room_roles,
  public.media_broadcast_invites TO factsport_v2_media_broadcast_admin;
GRANT INSERT ON public.media_broadcast_audit_events TO factsport_v2_media_broadcast_admin;
GRANT SELECT ON public.media_broadcast_rooms, public.media_broadcast_audit_events
  TO factsport_v2_media_broadcast_admin;

-- Token issuer: read room policy/roles/invites; consume invite use counts;
-- maintain participant state and append audit events. It cannot grant roles.
GRANT SELECT ON public.media_broadcast_rooms, public.media_studio_settings,
  public.media_broadcast_room_roles, public.media_broadcast_invites
  TO factsport_v2_broadcast_token_issuer;
GRANT UPDATE (use_count, last_used_at) ON public.media_broadcast_invites
  TO factsport_v2_broadcast_token_issuer;
GRANT SELECT, INSERT, UPDATE ON public.media_broadcast_participants
  TO factsport_v2_broadcast_token_issuer;
GRANT INSERT ON public.media_broadcast_audit_events
  TO factsport_v2_broadcast_token_issuer;

COMMIT;
