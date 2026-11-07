-- Media-owned public announcement settings; no Prediction affiliate fields.
BEGIN;

ALTER TABLE public.homepage_settings
  ADD COLUMN IF NOT EXISTS announcement_text text,
  ADD COLUMN IF NOT EXISTS announcement_link text,
  ADD COLUMN IF NOT EXISTS announcement_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.homepage_settings
  DROP CONSTRAINT IF EXISTS homepage_announcement_text_length,
  ADD CONSTRAINT homepage_announcement_text_length
    CHECK (announcement_text IS NULL OR char_length(announcement_text) <= 280),
  DROP CONSTRAINT IF EXISTS homepage_announcement_link_protocol,
  ADD CONSTRAINT homepage_announcement_link_protocol
    CHECK (announcement_link IS NULL OR announcement_link ~ '^https?://');

CREATE OR REPLACE VIEW public.public_homepage_settings AS
SELECT featured_match_id, announcement_text, announcement_link, announcement_enabled
FROM public.homepage_settings
WHERE singleton = true;

REVOKE ALL ON public.public_homepage_settings FROM PUBLIC;
GRANT SELECT ON public.public_homepage_settings TO factsport_v2_reader;

COMMIT;
