-- Grant the Media editorial writer role scoped access to public homepage announcements.
-- No access to Prediction affiliate/payment settings.
BEGIN;
GRANT SELECT, INSERT, UPDATE ON public.homepage_settings TO factsport_v2_editorial_writer;
REVOKE ALL ON public.homepage_settings FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer, factsport_v2_espn_writer;
COMMIT;
