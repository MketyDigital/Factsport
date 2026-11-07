-- Grant the newly introduced team-media attachment table after migration 0012.
BEGIN;
GRANT SELECT, INSERT, UPDATE ON public.editorial_article_team_media
  TO factsport_v2_editorial_writer;
REVOKE ALL ON public.editorial_article_team_media
  FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer, factsport_v2_espn_writer;
COMMIT;
