-- M75 rollback-only guest rating acceptance. Isolated factsport_v2 staging ONLY.
-- Migrations 0001,0008,0044-0048 and full role setup required.
BEGIN;
DO $verify$
DECLARE
  v_match uuid := gen_random_uuid();
  v_alias uuid := gen_random_uuid();
  v_token text := repeat('a',64);
  v_net text := repeat('1',64);
  v_other text := repeat('b',64);
  v_row_count integer;
BEGIN
  IF current_database() <> 'factsport_v2' THEN
    RAISE EXCEPTION 'Do not run player rating fixture outside isolated factsport_v2 staging';
  END IF;
  INSERT INTO public.matches
    (id,legacy_match_id,league,home_team,away_team,match_date,status,lineups)
  VALUES(v_match,v_alias,'M75 rating fixture','Home','Away',
    now()-interval '2 hours','FT',
    '{"home":[{"name":"Starter A","is_starter":true},{"name":"Bench A","is_starter":false}],"away":[{"name":"Starter B","is_starter":true}]}'::jsonb);
  IF NOT public.submit_anonymous_media_player_rating(v_token,v_net,v_alias,'Starter A',9)
    THEN RAISE EXCEPTION 'Valid anonymous vote not recorded'; END IF;
  SELECT count(*) INTO v_row_count FROM public.media_match_player_ratings
   WHERE match_id=v_match AND rating=9 AND visitor_id IS NOT NULL;
  IF v_row_count<>1 THEN RAISE EXCEPTION 'Alias failed to resolve canonical match'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.get_anonymous_media_player_ratings(v_token,v_match)
    WHERE player_name='Starter A' AND rating=9) THEN
    RAISE EXCEPTION 'Anonymous cookie vote state missing';
  END IF;
  BEGIN
    PERFORM public.submit_anonymous_media_player_rating(v_token,v_net,v_match,'Starter A',10);
    RAISE EXCEPTION 'Duplicate rating accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.submit_anonymous_media_player_rating(v_other,v_net,v_match,'Bench A',8);
    RAISE EXCEPTION 'Bench rating accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  IF NOT public.submit_anonymous_media_player_rating(v_other,v_net,v_match,'Starter B',7)
    THEN RAISE EXCEPTION 'Second visitor rating failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.public_media_player_rating_totals
    WHERE match_id=v_match AND player_name='Starter B' AND vote_count=1
    AND total_score=7) THEN
    RAISE EXCEPTION 'Public aggregate mismatch';
  END IF;
END
$verify$;
ROLLBACK;
