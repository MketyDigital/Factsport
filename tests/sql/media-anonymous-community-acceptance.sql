-- Factsport V2 anonymous Media acceptance test (after 0044-0047).
-- STAGING ONLY. Isolated factsport_v2 DB, privileged test operator.
-- All data rolled back; never run on production.
BEGIN;
DO $anonymous_acceptance$
DECLARE
  v_match uuid := gen_random_uuid();
  v_other_match uuid := gen_random_uuid();
  v_anon_a text := repeat('a', 64);
  v_anon_b text := repeat('b', 64);
  v_net_a text := repeat('1', 64);
  v_net_b text := repeat('2', 64);
  v_message uuid;
  v_count integer;
  v_voted boolean;
BEGIN
  IF current_database() <> 'factsport_v2' THEN
    RAISE EXCEPTION 'Wrong database for anonymous Media test';
  END IF;
  INSERT INTO public.matches (id, league, home_team, away_team, match_date, status, lineups)
  VALUES (
    v_match, 'Anonymous M73 fixture', 'Home', 'Away', now() - interval '30 minutes',
    'LIVE', '{"home":[{"name":"Player A","is_starter":true},{"name":"Sub A","is_starter":false}],"away":[{"name":"Player B","is_starter":true}]}'::jsonb
  ), (
    v_other_match, 'Anonymous M73 fixture', 'Home 2', 'Away 2', now() - interval '30 minutes',
    'LIVE', '{"home":[{"name":"Player X","is_starter":true}],"away":[]}'::jsonb
  );

  -- Account-free chat: none of these rows references public.app_users.
  SELECT public.submit_anonymous_media_chat(
    v_anon_a, v_net_a, v_match, 'Hello fellow fans!', NULL
  ) INTO v_message;
  IF v_message IS NULL THEN RAISE EXCEPTION 'Anonymous chat failed'; END IF;
  SELECT count(*) INTO v_count FROM public.media_match_chat_messages
    WHERE id = v_message AND author_user_id IS NULL AND visitor_id IS NOT NULL;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Chat depended on registered user'; END IF;

  -- Same token is throttled across matches, not just one chat room.
  BEGIN
    PERFORM public.submit_anonymous_media_chat(v_anon_a, v_net_a, v_other_match, 'Too soon', NULL);
    RAISE EXCEPTION 'Guest chat cooldown bypassed';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  -- Reply to a message from another match is forbidden.
  BEGIN
    PERFORM public.submit_anonymous_media_chat(v_anon_b, v_net_b, v_other_match, 'Off-topic reply', v_message);
    RAISE EXCEPTION 'Cross-match reply bypassed';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  -- A separate visitor may vote without an account.
  IF NOT public.submit_anonymous_media_motm(v_anon_a, v_net_a, v_match, 'Player A') THEN
    RAISE EXCEPTION 'Anonymous MOTM vote failed';
  END IF;
  SELECT public.get_anonymous_media_vote_state(v_anon_a, v_match) INTO v_voted;
  IF v_voted IS NOT TRUE THEN RAISE EXCEPTION 'Returning voter not recognized'; END IF;

  SELECT count(*) INTO v_count FROM public.media_match_motm_votes
    WHERE match_id = v_match AND voter_user_id IS NULL AND visitor_id IS NOT NULL;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Vote depended on registered user'; END IF;

  -- Same visitor cannot vote again, even for a different player.
  BEGIN
    PERFORM public.submit_anonymous_media_motm(v_anon_a, v_net_a, v_match, 'Player B');
    RAISE EXCEPTION 'Duplicate anonymous voter bypassed';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Different visitor can vote independently from a shared network, until
  -- anti-abuse network limits apply.
  IF NOT public.submit_anonymous_media_motm(v_anon_b, v_net_b, v_match, 'Player B') THEN
    RAISE EXCEPTION 'Second anonymous visitor rejected';
  END IF;

  -- Invented or bench players cannot receive valid votes.
  BEGIN
    PERFORM public.submit_anonymous_media_motm(repeat('c', 64), v_net_b, v_match, 'Sub A');
    RAISE EXCEPTION 'Bench player was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  IF EXISTS (
    SELECT 1 FROM public.public_media_match_chat_messages
    WHERE id = v_message AND username IS NULL
  ) THEN RAISE EXCEPTION 'Anonymous chat display name missing'; END IF;
END
$anonymous_acceptance$;
ROLLBACK;
