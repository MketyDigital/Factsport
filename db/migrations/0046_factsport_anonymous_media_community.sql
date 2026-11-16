-- Anonymous Factsport Media participation, without accounts or D1.
-- Must follow 0044 and 0045. Apply on isolated V2 staging first.
BEGIN;

CREATE TABLE public.media_visitor_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash char(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  suspended_at timestamptz
);

ALTER TABLE public.media_match_chat_messages
  ALTER COLUMN author_user_id DROP NOT NULL,
  ADD COLUMN visitor_id uuid REFERENCES public.media_visitor_participants(id) ON DELETE RESTRICT,
  ADD CONSTRAINT media_chat_exactly_one_identity
    CHECK ((author_user_id IS NULL) <> (visitor_id IS NULL));

ALTER TABLE public.media_match_motm_votes
  ALTER COLUMN voter_user_id DROP NOT NULL,
  ADD COLUMN visitor_id uuid REFERENCES public.media_visitor_participants(id) ON DELETE RESTRICT,
  ADD CONSTRAINT media_motm_exactly_one_identity
    CHECK ((voter_user_id IS NULL) <> (visitor_id IS NULL));

CREATE INDEX media_chat_visitor_recent_idx
  ON public.media_match_chat_messages (visitor_id, created_at DESC)
  WHERE visitor_id IS NOT NULL;
CREATE UNIQUE INDEX media_motm_visitor_once_idx
  ON public.media_match_motm_votes (match_id, visitor_id)
  WHERE visitor_id IS NOT NULL;

-- Anonymous callers share an independently derived rotating network token.
-- Hashes are produced server-side using a private pepper; no raw IP stored.
CREATE TABLE public.media_community_network_limits (
  network_hash char(64) NOT NULL CHECK (network_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz NOT NULL,
  actions integer NOT NULL DEFAULT 0 CHECK (actions >= 0),
  PRIMARY KEY (network_hash, window_start)
);

-- Reinstall the 0045 chat trigger to serialize by the actual actor.
CREATE OR REPLACE FUNCTION public.enforce_media_chat_message_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  match_status text; kick_time timestamptz; last_post timestamptz; parent_match uuid;
BEGIN
  NEW.created_at := clock_timestamp();
  NEW.message := btrim(NEW.message);
  NEW.display_name := btrim(NEW.display_name);
  IF NEW.message IS NULL OR char_length(NEW.message) NOT BETWEEN 1 AND 1500
    OR NEW.display_name IS NULL OR char_length(NEW.display_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'invalid_chat_message' USING ERRCODE = '22023';
  END IF;
  IF NEW.message ~* '(https?://|www\.|\[ADMIN_ALERT\]|\[Reply @)' THEN
    RAISE EXCEPTION 'chat_links_or_reserved_markup_not_allowed' USING ERRCODE = '22023';
  END IF;
  SELECT status, match_date INTO match_status, kick_time
    FROM public.matches WHERE id = NEW.match_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_match' USING ERRCODE = '22023'; END IF;
  IF upper(match_status) IN ('FT','FINISHED','POST','ENDED','FULL TIME','AET','PEN','AWARDED','ABD')
     OR NEW.created_at > kick_time + interval '4 hours' THEN
    RAISE EXCEPTION 'chat_closed' USING ERRCODE = '22023';
  END IF;
  IF NEW.reply_to_id IS NOT NULL THEN
    SELECT match_id INTO parent_match FROM public.media_match_chat_messages
      WHERE id = NEW.reply_to_id AND hidden_at IS NULL;
    IF parent_match IS DISTINCT FROM NEW.match_id THEN
      RAISE EXCEPTION 'invalid_chat_reply' USING ERRCODE = '22023';
    END IF;
  END IF;
  -- One lock and throttle for the current user or visitor, never a nullable ID.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    COALESCE('visitor:' || NEW.visitor_id::text, 'user:' || NEW.author_user_id::text), 1046));
  SELECT max(created_at) INTO last_post
  FROM public.media_match_chat_messages
  WHERE (NEW.visitor_id IS NOT NULL AND visitor_id = NEW.visitor_id)
     OR (NEW.author_user_id IS NOT NULL AND author_user_id = NEW.author_user_id);
  IF last_post IS NOT NULL AND NEW.created_at < last_post + interval '3 seconds' THEN
    RAISE EXCEPTION 'chat_rate_limited' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

-- Explicit minute buckets prevent unlimited cookie-reset messages/votes.
-- Rate checks must be serialized under the network hash to avoid races.
CREATE FUNCTION public.consume_media_community_network_limit(
  p_network_hash text, p_limit integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE v_start timestamptz; v_actions integer;
BEGIN
  IF p_network_hash IS NULL OR p_network_hash !~ '^[a-f0-9]{64}$'
    OR p_limit NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'invalid_network_limit' USING ERRCODE = '22023';
  END IF;
  v_start := date_trunc('minute', clock_timestamp());
  PERFORM pg_advisory_xact_lock(hashtextextended(p_network_hash, 2046));
  INSERT INTO public.media_community_network_limits (network_hash, window_start, actions)
  VALUES (p_network_hash, v_start, 1)
  ON CONFLICT (network_hash, window_start) DO UPDATE
    SET actions = public.media_community_network_limits.actions + 1
  RETURNING actions INTO v_actions;
  RETURN v_actions <= p_limit;
END;
$function$;

-- No browser identity, display name, user ID, or role is accepted as authority.
-- The caller must use a separate, locked-down Hyperdrive PostgreSQL login.
CREATE FUNCTION public.submit_anonymous_media_chat(
  p_token_hash text, p_network_hash text, p_match_id uuid, p_message text,
  p_reply_to uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE v_id uuid; v_message_id uuid;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid_visitor' USING ERRCODE = '22023';
  END IF;
  IF p_message IS NULL OR char_length(btrim(p_message)) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid_message' USING ERRCODE = '22023';
  END IF;
  IF NOT public.consume_media_community_network_limit(p_network_hash, 12) THEN
    RAISE EXCEPTION 'community_network_rate_limited' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.media_visitor_participants (token_hash)
    VALUES (p_token_hash)
    ON CONFLICT (token_hash) DO UPDATE SET last_active_at = now()
    RETURNING id INTO v_id;
  IF EXISTS (SELECT 1 FROM public.media_visitor_participants
             WHERE id = v_id AND suspended_at IS NOT NULL) THEN
    RAISE EXCEPTION 'community_visitor_suspended' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.media_match_chat_messages
    (match_id, visitor_id, display_name, message, reply_to_id)
  VALUES (p_match_id, v_id, 'Fan ' || upper(left(v_id::text, 6)), btrim(p_message), p_reply_to)
  RETURNING id INTO v_message_id;
  RETURN v_message_id;
END;
$function$;

CREATE FUNCTION public.submit_anonymous_media_motm(
  p_token_hash text, p_network_hash text, p_match_id uuid, p_player_name text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE v_id uuid;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid_visitor' USING ERRCODE = '22023';
  END IF;
  IF p_player_name IS NULL OR char_length(btrim(p_player_name)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'invalid_candidate' USING ERRCODE = '22023';
  END IF;
  IF NOT public.consume_media_community_network_limit(p_network_hash, 8) THEN
    RAISE EXCEPTION 'community_network_rate_limited' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.media_visitor_participants (token_hash)
    VALUES (p_token_hash)
    ON CONFLICT (token_hash) DO UPDATE SET last_active_at = now()
    RETURNING id INTO v_id;
  IF EXISTS (SELECT 1 FROM public.media_visitor_participants
             WHERE id = v_id AND suspended_at IS NOT NULL) THEN
    RAISE EXCEPTION 'community_visitor_suspended' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.media_match_motm_votes (match_id, visitor_id, player_name)
    VALUES (p_match_id, v_id, btrim(p_player_name));
  RETURN true;
END;
$function$;

-- Functions are not publicly executable. A dedicated community API login,
-- separate from the Media editor, Prediction, and match reader, must be
-- provisioned before a staging enablement migration can grant EXECUTE.
REVOKE ALL ON public.media_visitor_participants,
  public.media_community_network_limits FROM PUBLIC, factsport_v2_reader;
REVOKE ALL ON FUNCTION public.consume_media_community_network_limit(text, integer)
  FROM PUBLIC, factsport_v2_reader;
REVOKE ALL ON FUNCTION public.submit_anonymous_media_chat(text, text, uuid, text, uuid)
  FROM PUBLIC, factsport_v2_reader;
REVOKE ALL ON FUNCTION public.submit_anonymous_media_motm(text, text, uuid, text)
  FROM PUBLIC, factsport_v2_reader;
REVOKE ALL ON FUNCTION public.enforce_media_chat_message_integrity()
  FROM PUBLIC, factsport_v2_reader;
COMMIT;
