-- Preserve Media-owned frontend match metadata without polluting Prediction state.
-- Sports scores/events remain on matches; editorial playback/pins/stream configuration
-- live in match_media and are joined only by Media read adapters.
BEGIN;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS display_clock text,
  ADD COLUMN IF NOT EXISTS clock_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_widget_id text;

CREATE TABLE IF NOT EXISTS public.match_media (
  match_id uuid PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  video_url text,
  livestream_url text,
  audio_url text,
  media_url text,
  stream_url text,
  media_mode text CHECK (media_mode IS NULL OR media_mode IN ('audio', 'video')),
  chat_pin_text text CHECK (chat_pin_text IS NULL OR char_length(chat_pin_text) <= 2000),
  chat_pin_link text,
  rights_status text NOT NULL DEFAULT 'pending'
    CHECK (rights_status IN ('pending', 'owned', 'licensed', 'editorial_exception', 'rejected', 'expired')),
  rights_reference text,
  attribution_text text,
  rights_reviewed_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  rights_reviewed_at timestamptz,
  usage_expires_at timestamptz,
  is_public boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_media_rights_reference CHECK (
    rights_status NOT IN ('licensed', 'editorial_exception') OR rights_reference IS NOT NULL
  ),
  CONSTRAINT match_media_public_rights_gate CHECK (
    NOT is_public OR (
      rights_status IN ('owned', 'licensed', 'editorial_exception')
      AND rights_reviewed_by IS NOT NULL
      AND rights_reviewed_at IS NOT NULL
      AND (usage_expires_at IS NULL OR usage_expires_at > now())
    )
  ),
  CONSTRAINT match_media_safe_video_url CHECK (
    video_url IS NULL OR video_url = 'streamio' OR
    (video_url ~ '^https?://' AND video_url !~ '^https?://[^/]*@') OR
    (video_url ~ '^/' AND video_url !~ '^//')
  ),
  CONSTRAINT match_media_safe_livestream_url CHECK (
    livestream_url IS NULL OR livestream_url = 'streamio' OR
    (livestream_url ~ '^https?://' AND livestream_url !~ '^https?://[^/]*@') OR
    (livestream_url ~ '^/' AND livestream_url !~ '^//')
  ),
  CONSTRAINT match_media_safe_audio_url CHECK (
    audio_url IS NULL OR audio_url = 'streamio' OR
    (audio_url ~ '^https?://' AND audio_url !~ '^https?://[^/]*@') OR
    (audio_url ~ '^/' AND audio_url !~ '^//')
  ),
  CONSTRAINT match_media_safe_media_url CHECK (
    media_url IS NULL OR media_url = 'streamio' OR
    (media_url ~ '^https?://' AND media_url !~ '^https?://[^/]*@') OR
    (media_url ~ '^/' AND media_url !~ '^//')
  ),
  CONSTRAINT match_media_safe_stream_url CHECK (
    stream_url IS NULL OR stream_url = 'streamio' OR
    (stream_url ~ '^https?://' AND stream_url !~ '^https?://[^/]*@') OR
    (stream_url ~ '^/' AND stream_url !~ '^//')
  ),
  CONSTRAINT match_media_safe_chat_pin_link CHECK (
    chat_pin_link IS NULL OR
    (chat_pin_link ~ '^https?://' AND chat_pin_link !~ '^https?://[^/]*@') OR
    (chat_pin_link ~ '^/' AND chat_pin_link !~ '^//')
  )
);

CREATE OR REPLACE VIEW public.public_match_media AS
SELECT
  match_id, video_url, livestream_url, audio_url, media_url, stream_url,
  media_mode, chat_pin_text, chat_pin_link, attribution_text, usage_expires_at
FROM public.match_media
WHERE is_public = true
  AND rights_status IN ('owned', 'licensed', 'editorial_exception')
  AND rights_reviewed_by IS NOT NULL
  AND rights_reviewed_at IS NOT NULL
  AND (usage_expires_at IS NULL OR usage_expires_at > now());

REVOKE ALL ON public.match_media, public.public_match_media
  FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer, factsport_v2_espn_writer;
GRANT SELECT ON public.public_match_media TO factsport_v2_reader;
GRANT SELECT, INSERT, UPDATE ON public.match_media TO factsport_v2_editorial_writer;

-- The ESPN live updater may refresh only the display clock, not editorial media links.
GRANT UPDATE (display_clock, clock_updated_at)
  ON public.matches TO factsport_v2_espn_writer;

COMMIT;
