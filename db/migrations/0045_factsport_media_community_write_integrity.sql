-- Factsport Media community write integrity. PostgreSQL only; NEVER D1.
-- Apply to isolated factsport_v2 only, after migrations 0008 and 0044.
-- No public or service roles receive chat/vote write privileges in this migration.
-- The eventual Media community API must derive user IDs from verified identity.
BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_media_chat_message_integrity()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  match_status text;
  kick_time timestamptz;
  last_post timestamptz;
  parent_match uuid;
BEGIN
  -- Always use database time, not client-provided timestamps.
  NEW.created_at := clock_timestamp();
  NEW.message := btrim(NEW.message);
  NEW.display_name := btrim(NEW.display_name);
  IF NEW.message IS NULL OR char_length(NEW.message) NOT BETWEEN 1 AND 1500 THEN
    RAISE EXCEPTION 'invalid_chat_message' USING ERRCODE = '22023';
  END IF;
  IF NEW.display_name IS NULL OR char_length(NEW.display_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'invalid_chat_author' USING ERRCODE = '22023';
  END IF;
  -- Reserve official-announcement and legacy reply markup for the verified
  -- moderator action, not arbitrary fan messages.
  IF NEW.message ~* '(https?://|www\.|\[ADMIN_ALERT\]|\[Reply @)' THEN
    RAISE EXCEPTION 'chat_links_or_reserved_markup_not_allowed' USING ERRCODE = '22023';
  END IF;

  SELECT status, match_date INTO match_status, kick_time
  FROM public.matches WHERE id = NEW.match_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_match' USING ERRCODE = '22023';
  END IF;
  IF upper(match_status) IN ('FT','FINISHED','POST','ENDED','FULL TIME','AET','PEN','AWARDED','ABD')
      OR NEW.created_at > kick_time + interval '4 hours' THEN
    RAISE EXCEPTION 'chat_closed' USING ERRCODE = '22023';
  END IF;

  IF NEW.reply_to_id IS NOT NULL THEN
    SELECT match_id INTO parent_match
    FROM public.media_match_chat_messages
    WHERE id = NEW.reply_to_id AND hidden_at IS NULL;
    IF parent_match IS DISTINCT FROM NEW.match_id THEN
      RAISE EXCEPTION 'invalid_chat_reply' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Serialize this author's messages across every match to stop parallel
  -- 3-second-limit bypasses. Do not use an in-memory Worker Map.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.author_user_id::text, 1045));
  SELECT max(created_at) INTO last_post
  FROM public.media_match_chat_messages
  WHERE author_user_id = NEW.author_user_id;
  IF last_post IS NOT NULL AND NEW.created_at < last_post + interval '3 seconds' THEN
    RAISE EXCEPTION 'chat_rate_limited' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS media_match_chat_integrity_insert ON public.media_match_chat_messages;
CREATE TRIGGER media_match_chat_integrity_insert
BEFORE INSERT ON public.media_match_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_media_chat_message_integrity();

CREATE OR REPLACE FUNCTION public.enforce_media_motm_vote_integrity()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  match_lineups jsonb;
  kick_time timestamptz;
  home_roster jsonb;
  away_roster jsonb;
  valid_candidate boolean;
BEGIN
  NEW.created_at := clock_timestamp();
  NEW.player_name := btrim(NEW.player_name);
  IF NEW.player_name IS NULL OR char_length(NEW.player_name) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'invalid_motm_candidate' USING ERRCODE = '22023';
  END IF;
  SELECT lineups, match_date INTO match_lineups, kick_time
  FROM public.matches WHERE id = NEW.match_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_match' USING ERRCODE = '22023'; END IF;
  -- Voter eligibility is limited to kick-off through 24 hours afterward.
  IF NEW.created_at < kick_time OR NEW.created_at > kick_time + interval '24 hours' THEN
    RAISE EXCEPTION 'motm_voting_closed' USING ERRCODE = '22023';
  END IF;
  -- Legacy Worker populated home/away JSON arrays of named players and
  -- is_starter booleans. Never trust a name supplied by the frontend alone.
  home_roster := match_lineups -> 'home';
  away_roster := match_lineups -> 'away';
  IF jsonb_typeof(home_roster) IS DISTINCT FROM 'array' THEN home_roster := '[]'::jsonb; END IF;
  IF jsonb_typeof(away_roster) IS DISTINCT FROM 'array' THEN away_roster := '[]'::jsonb; END IF;
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(home_roster || away_roster) AS player(row)
    WHERE player.row ->> 'name' = NEW.player_name
      AND player.row ->> 'is_starter' = 'true'
  ) INTO valid_candidate;
  IF NOT valid_candidate THEN
    RAISE EXCEPTION 'motm_player_not_in_verified_starting_lineup' USING ERRCODE = '22023';
  END IF;
  -- One vote per user per match is additionally enforced by migration 0044's
  -- UNIQUE(match_id, voter_user_id) constraint under concurrent inserts.
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS media_match_motm_integrity_insert ON public.media_match_motm_votes;
CREATE TRIGGER media_match_motm_integrity_insert
BEFORE INSERT ON public.media_match_motm_votes
FOR EACH ROW EXECUTE FUNCTION public.enforce_media_motm_vote_integrity();

-- SECURITY DEFINER routines are invoked via triggers, never callable RPCs.
REVOKE ALL ON FUNCTION public.enforce_media_chat_message_integrity()
  FROM PUBLIC, factsport_v2_reader;
REVOKE ALL ON FUNCTION public.enforce_media_motm_vote_integrity()
  FROM PUBLIC, factsport_v2_reader;

-- No active community API role is granted INSERT/UPDATE/DELETE yet.
-- V2 routes retain 503 on POST until identity and moderator permissions pass.
COMMIT;
