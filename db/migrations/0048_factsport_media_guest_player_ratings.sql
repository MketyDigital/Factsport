-- M75: replace legacy D1 player-rating Worker with account-free PostgreSQL.
-- Depends on 0008, 0044-0047. Isolated factsport_v2 staging only.
BEGIN;
CREATE TABLE public.media_match_player_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE RESTRICT,
  visitor_id uuid NOT NULL REFERENCES public.media_visitor_participants(id) ON DELETE RESTRICT,
  player_name text NOT NULL CHECK (char_length(player_name) BETWEEN 1 AND 120),
  rating smallint NOT NULL CHECK (rating BETWEEN 6 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_match_player_rating_once UNIQUE(match_id, visitor_id, player_name)
);
CREATE INDEX media_match_player_rating_aggregate_idx
 ON public.media_match_player_ratings (match_id, player_name);

CREATE VIEW public.public_media_player_rating_totals AS
 SELECT match_id, player_name, sum(rating)::integer AS total_score,
        count(*)::integer AS vote_count
 FROM public.media_match_player_ratings
 GROUP BY match_id, player_name;

CREATE FUNCTION public.submit_anonymous_media_player_rating(
 p_token_hash text, p_network_hash text, p_match_id uuid,
 p_player_name text, p_rating integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE v_visitor uuid; v_match uuid; v_kickoff timestamptz;
        v_status text; v_lineups jsonb; v_home jsonb; v_away jsonb;
BEGIN
 IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$'
   OR p_player_name IS NULL OR char_length(btrim(p_player_name)) NOT BETWEEN 1 AND 120
   OR p_rating IS NULL OR p_rating NOT BETWEEN 6 AND 10 THEN
   RAISE EXCEPTION 'invalid_rating_request' USING ERRCODE = '22023';
 END IF;
 SELECT id, match_date, status, lineups
   INTO v_match, v_kickoff, v_status, v_lineups
   FROM public.matches
   WHERE id = p_match_id OR legacy_match_id = p_match_id
   ORDER BY CASE WHEN id = p_match_id THEN 0 ELSE 1 END
   LIMIT 1;
 IF v_match IS NULL THEN RAISE EXCEPTION 'unknown_match' USING ERRCODE = '22023'; END IF;
 -- Legacy fan ratings only appear after full time; preserve that restriction.
 IF upper(COALESCE(v_status,'')) NOT IN ('FT','FINISHED','POST','ENDED','AET','PEN','AWARDED')
   OR clock_timestamp() < v_kickoff
   OR clock_timestamp() > v_kickoff + interval '24 hours' THEN
   RAISE EXCEPTION 'rating_window_closed' USING ERRCODE = '22023';
 END IF;
 v_home := v_lineups -> 'home'; v_away := v_lineups -> 'away';
 IF jsonb_typeof(v_home) IS DISTINCT FROM 'array' THEN v_home := '[]'::jsonb; END IF;
 IF jsonb_typeof(v_away) IS DISTINCT FROM 'array' THEN v_away := '[]'::jsonb; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM jsonb_array_elements(v_home || v_away) AS player(item)
   WHERE player.item ->> 'name' = btrim(p_player_name)
     AND player.item ->> 'is_starter' = 'true'
 ) THEN RAISE EXCEPTION 'invalid_rating_player' USING ERRCODE = '22023'; END IF;
 IF NOT public.consume_media_community_network_limit(p_network_hash, 30) THEN
   RAISE EXCEPTION 'community_network_rate_limited' USING ERRCODE = '23514';
 END IF;
 INSERT INTO public.media_visitor_participants(token_hash)
 VALUES (p_token_hash)
 ON CONFLICT(token_hash) DO UPDATE SET last_active_at=now()
 RETURNING id INTO v_visitor;
 IF EXISTS(SELECT 1 FROM public.media_visitor_participants
           WHERE id=v_visitor AND suspended_at IS NOT NULL) THEN
   RAISE EXCEPTION 'community_visitor_suspended' USING ERRCODE = '42501';
 END IF;
 INSERT INTO public.media_match_player_ratings(match_id,visitor_id,player_name,rating)
 VALUES (v_match,v_visitor,btrim(p_player_name),p_rating);
 RETURN true;
END;
$function$;

CREATE FUNCTION public.get_anonymous_media_player_ratings(
 p_token_hash text, p_match_id uuid
) RETURNS TABLE(player_name text, rating smallint)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
 IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN RETURN; END IF;
 RETURN QUERY SELECT r.player_name, r.rating
 FROM public.media_match_player_ratings r
 JOIN public.media_visitor_participants v ON v.id = r.visitor_id
 WHERE v.token_hash = p_token_hash
 AND r.match_id = (SELECT id FROM public.matches
     WHERE id=p_match_id OR legacy_match_id=p_match_id
     ORDER BY CASE WHEN id=p_match_id THEN 0 ELSE 1 END LIMIT 1);
END;
$function$;

REVOKE ALL ON public.media_match_player_ratings,
 public.public_media_player_rating_totals FROM PUBLIC, factsport_v2_reader,
 factsport_v2_community_api;
GRANT SELECT ON public.public_media_player_rating_totals TO factsport_v2_reader;
REVOKE ALL ON FUNCTION public.submit_anonymous_media_player_rating(text,text,uuid,text,integer),
 public.get_anonymous_media_player_ratings(text,uuid) FROM PUBLIC, factsport_v2_reader;
GRANT EXECUTE ON FUNCTION public.submit_anonymous_media_player_rating(text,text,uuid,text,integer),
 public.get_anonymous_media_player_ratings(text,uuid) TO factsport_v2_community_api;
COMMIT;
