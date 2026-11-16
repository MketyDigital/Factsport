-- Media community chat and MOTM replace the former external D1 Worker storage.
-- Reference: docs/audit/legacy-source/external-chat-d1-worker-v1.js.txt
-- Reference: docs/audit/legacy-source/external-fast-espn-motm-d1-worker-v1.js.txt
-- Schema-only, fail-closed migration for the isolated factsport_v2 database.
-- No legacy D1 binding, sync, import, Supabase fallback or public writes.
BEGIN;

CREATE TABLE IF NOT EXISTS public.media_match_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE RESTRICT,
  author_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  avatar_url text CHECK (avatar_url IS NULL OR (
    char_length(avatar_url) <= 1024 AND
    avatar_url ~ '^https://' AND avatar_url !~ '^https://[^/]*@'
  )),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1500),
  reply_to_id uuid REFERENCES public.media_match_chat_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  hidden_at timestamptz,
  hidden_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  CONSTRAINT media_chat_hide_actor CHECK (
    (hidden_at IS NULL AND hidden_by IS NULL) OR
    (hidden_at IS NOT NULL AND hidden_by IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS media_match_chat_recent_idx
  ON public.media_match_chat_messages (match_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS media_match_chat_author_idx
  ON public.media_match_chat_messages (author_user_id, created_at DESC);

-- A public projection never exposes voter identities, author user IDs, or
-- moderation history. Published messages stay subject to server moderation.
CREATE OR REPLACE VIEW public.public_media_match_chat_messages AS
SELECT id, match_id, display_name AS username, avatar_url, message, created_at
FROM public.media_match_chat_messages
WHERE hidden_at IS NULL;

CREATE TABLE IF NOT EXISTS public.media_match_motm_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE RESTRICT,
  voter_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  player_name text NOT NULL CHECK (char_length(player_name) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_match_motm_one_vote_per_user UNIQUE (match_id, voter_user_id)
);
CREATE INDEX IF NOT EXISTS media_match_motm_match_idx
  ON public.media_match_motm_votes (match_id, player_name);
CREATE OR REPLACE VIEW public.public_media_match_motm_totals AS
SELECT match_id, player_name, count(*)::integer AS votes
FROM public.media_match_motm_votes
GROUP BY match_id, player_name;

REVOKE ALL ON public.media_match_chat_messages,
  public.media_match_motm_votes,
  public.public_media_match_chat_messages,
  public.public_media_match_motm_totals
  FROM PUBLIC, factsport_v2_reader;
GRANT SELECT ON public.public_media_match_chat_messages,
  public.public_media_match_motm_totals TO factsport_v2_reader;

-- No INSERT/UPDATE/DELETE grants to the public reader, schedule writer,
-- ESPN writer, editorial writer, broadcast token issuer, or Prediction roles.
-- Dedicated Media community API identity and authenticated write functions
-- must be designed, provisioned and exercised in isolated staging first.
COMMIT;
