-- The V2 Media community uses an isolated, function-only PostgreSQL role.
-- This role is NOLOGIN. An explicit staging bootstrap must separately create
-- a distinct LOGIN for the FACTSPORT_COMMUNITY_HYPERDRIVE binding and grant
-- this role to it. No credentials, D1, Supabase or Prediction role is reused.
BEGIN;
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='factsport_v2_community_api') THEN
    CREATE ROLE factsport_v2_community_api NOLOGIN NOINHERIT
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END;
$role$;

-- This cannot reveal identities or vote data for other visitors: the
-- token is a server-derived SHA-256 hash of an HMAC-protected HttpOnly cookie.
CREATE FUNCTION public.get_anonymous_media_vote_state(
  p_token_hash text, p_match_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.media_match_motm_votes v
    JOIN public.media_visitor_participants p ON p.id = v.visitor_id
    WHERE p.token_hash = p_token_hash AND v.match_id = (
      SELECT id FROM public.matches
      WHERE id = p_match_id OR legacy_match_id = p_match_id
      ORDER BY CASE WHEN id = p_match_id THEN 0 ELSE 1 END LIMIT 1
    )
  );
END;
$function$;

-- Definer routines, not the private tables, are the only write capability.
REVOKE ALL ON public.media_visitor_participants,
  public.media_community_network_limits,
  public.media_match_chat_messages, public.media_match_motm_votes
  FROM factsport_v2_community_api;
REVOKE ALL ON FUNCTION public.get_anonymous_media_vote_state(text, uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO factsport_v2_community_api;
GRANT EXECUTE ON FUNCTION public.submit_anonymous_media_chat(text, text, uuid, text, uuid)
  TO factsport_v2_community_api;
GRANT EXECUTE ON FUNCTION public.submit_anonymous_media_motm(text, text, uuid, text)
  TO factsport_v2_community_api;
GRANT EXECUTE ON FUNCTION public.get_anonymous_media_vote_state(text, uuid)
  TO factsport_v2_community_api;

-- No direct SELECT on private votes/messages; no direct INSERT/UPDATE/DELETE.
-- Other runtime roles, including Prediction and editorial, stay isolated.
COMMIT;
