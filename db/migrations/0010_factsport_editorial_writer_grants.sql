-- Factsport V2 editorial application writer grants.
-- Run only after the dedicated factsport_v2_editorial_writer role and
-- FACTSPORT_EDITORIAL_HYPERDRIVE have been provisioned and independently verified.
-- This role is not the public reader, schedule writer, or ESPN writer.
BEGIN;

GRANT USAGE ON SCHEMA public TO factsport_v2_editorial_writer;

-- Editorial content and revision history. No DELETE or TRUNCATE privileges.
GRANT SELECT, INSERT, UPDATE ON public.editorial_articles
  TO factsport_v2_editorial_writer;
GRANT SELECT, INSERT, UPDATE ON public.editorial_article_revisions
  TO factsport_v2_editorial_writer;
GRANT SELECT, INSERT, UPDATE ON public.editorial_article_media
  TO factsport_v2_editorial_writer;
GRANT SELECT, INSERT, UPDATE ON public.media_assets
  TO factsport_v2_editorial_writer;
GRANT SELECT, INSERT ON public.editorial_article_sources
  TO factsport_v2_editorial_writer;

-- Resolve authenticated administrator IDs through the explicit domain bridge.
-- Column-level access only; do not expose the private identity table wholesale.
GRANT SELECT (issuer, subject, user_id, created_at)
  ON public.external_identities TO factsport_v2_editorial_writer;

-- Editorial UI may prepare social posts and enqueue them. It cannot dispatch,
-- mark deliveries, or read provider credentials.
GRANT SELECT ON public.media_social_channels
  TO factsport_v2_editorial_writer;
GRANT SELECT, INSERT, UPDATE ON public.media_social_publications
  TO factsport_v2_editorial_writer;
GRANT INSERT ON public.media_social_outbox
  TO factsport_v2_editorial_writer;

-- Explicitly preserve private-table isolation from public runtime identities.
REVOKE ALL ON public.editorial_articles, public.editorial_article_revisions,
  public.editorial_article_media, public.editorial_article_sources,
  public.media_assets, public.media_social_channels,
  public.media_social_publications, public.media_social_delivery_attempts,
  public.media_social_outbox
FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer, factsport_v2_espn_writer;

COMMIT;
