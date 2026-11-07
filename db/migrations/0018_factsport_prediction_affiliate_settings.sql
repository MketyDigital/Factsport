-- Prediction-owned public affiliate display settings.
-- Media homepage selection remains in homepage_settings; this table owns only
-- the public referral codes/links used by prediction monetization surfaces.
BEGIN;

CREATE TABLE IF NOT EXISTS public.prediction_affiliate_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  link_1xbet text CHECK (link_1xbet IS NULL OR (link_1xbet ~ '^https://' AND link_1xbet !~ '^https://[^/]*@')),
  code_1xbet text CHECK (code_1xbet IS NULL OR char_length(code_1xbet) <= 128),
  link_melbet text CHECK (link_melbet IS NULL OR (link_melbet ~ '^https://' AND link_melbet !~ '^https://[^/]*@')),
  code_melbet text CHECK (code_melbet IS NULL OR char_length(code_melbet) <= 128),
  updated_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW public.public_prediction_affiliate_settings AS
SELECT link_1xbet, code_1xbet, link_melbet, code_melbet
FROM public.prediction_affiliate_settings
WHERE singleton = true;

REVOKE ALL ON public.prediction_affiliate_settings,
  public.public_prediction_affiliate_settings
FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer,
  factsport_v2_espn_writer, factsport_v2_editorial_writer;
GRANT SELECT ON public.public_prediction_affiliate_settings TO factsport_v2_reader;

-- Writes require a dedicated Prediction admin role. Do not grant this table
-- to the Media editorial writer or shared social dispatcher.
COMMIT;
