-- M72 isolated-STAGING PostgreSQL acceptance test for migrations 0044/0045.
-- Requires an authorized staging admin connection to factsport_v2.
-- Entire fixture is rolled back; NEVER run against production.
-- Execute with psql -v ON_ERROR_STOP=1 -f tests/sql/media-community-write-integrity-acceptance.sql
BEGIN;

DO $verify$
DECLARE
  match_a uuid := gen_random_uuid();
  match_b uuid := gen_random_uuid();
  match_c uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  first_message uuid;
BEGIN
  IF current_database() <> 'factsport_v2' THEN
    RAISE EXCEPTION 'Wrong database: only factsport_v2 staging is supported.';
  END IF;

  INSERT INTO public.app_users (id) VALUES (user_a), (user_b);
  INSERT INTO public.matches (id, league, home_team, away_team, match_date, status, lineups)
  VALUES
    (match_a, 'M72 staging fixture', 'Test Home', 'Test Away', now() - interval '1 hour', 'LIVE',
      '{"home":[{"name":"Starter Alpha","is_starter":true},{"name":"Bench Player","is_starter":false}],"away":[{"name":"Starter Beta","is_starter":true}]}'::jsonb),
    (match_b, 'M72 staging fixture', 'Test Home B', 'Test Away B', now() - interval '30 hours', 'FT',
      '{"home":[{"name":"Starter Alpha","is_starter":true}],"away":[]}'::jsonb),
    (match_c, 'M72 staging fixture', 'Test Home C', 'Test Away C', now() - interval '1 hour', 'LIVE',
      '{"home":[],"away":[]}'::jsonb);

  -- Valid post.
  INSERT INTO public.media_match_chat_messages
    (match_id, author_user_id, display_name, message)
  VALUES (match_a, user_a, 'Staging Fan', 'A safe match comment')
  RETURNING id INTO first_message;

  -- A second immediate post cannot bypass the per-author three-second lock.
  BEGIN
    INSERT INTO public.media_match_chat_messages (match_id, author_user_id, display_name, message)
    VALUES (match_a, user_a, 'Staging Fan', 'Rapid duplicate comment');
    RAISE EXCEPTION 'chat rate control did not reject duplicate';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  -- Links and official announcement markup are reserved.
  BEGIN
    INSERT INTO public.media_match_chat_messages (match_id, author_user_id, display_name, message)
    VALUES (match_a, user_b, 'Other Fan', 'https://untrusted.example');
    RAISE EXCEPTION 'chat link filter failed';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  -- Replies may not refer to another match.
  BEGIN
    INSERT INTO public.media_match_chat_messages
      (match_id, author_user_id, display_name, message, reply_to_id)
    VALUES (match_c, user_b, 'Other Fan', 'Wrong match reply', first_message);
    RAISE EXCEPTION 'cross-match reply filter failed';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  -- Finished-match chat is closed.
  BEGIN
    INSERT INTO public.media_match_chat_messages (match_id, author_user_id, display_name, message)
    VALUES (match_b, user_b, 'Other Fan', 'Post after final whistle');
    RAISE EXCEPTION 'chat close rule failed';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  -- Verified starter, inside 24 hours: accepted.
  INSERT INTO public.media_match_motm_votes (match_id, voter_user_id, player_name)
  VALUES (match_a, user_a, 'Starter Alpha');

  -- Concurrent uniqueness is backed by a unique index, not a browser flag.
  BEGIN
    INSERT INTO public.media_match_motm_votes (match_id, voter_user_id, player_name)
    VALUES (match_a, user_a, 'Starter Beta');
    RAISE EXCEPTION 'duplicate voter was not rejected';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Bench and invented candidates are both prohibited.
  BEGIN
    INSERT INTO public.media_match_motm_votes (match_id, voter_user_id, player_name)
    VALUES (match_a, user_b, 'Bench Player');
    RAISE EXCEPTION 'bench candidate was allowed';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  -- More than 24 hours after kickoff: voting closed.
  BEGIN
    INSERT INTO public.media_match_motm_votes (match_id, voter_user_id, player_name)
    VALUES (match_b, user_b, 'Starter Alpha');
    RAISE EXCEPTION 'expired MOTM vote was allowed';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
END
$verify$;

ROLLBACK;
