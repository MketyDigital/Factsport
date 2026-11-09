-- Tighten the editorial writer's media-asset mutation surface.
-- Upload still inserts assets; rights review and publication may update only the
-- fields explicitly owned by those workflows. No object identity or content
-- metadata can be rewritten in place.
BEGIN;

REVOKE UPDATE ON public.media_assets FROM factsport_v2_editorial_writer;

GRANT UPDATE (
  rights_status,
  rights_reference,
  attribution_text,
  alt_text,
  usage_expires_at,
  rights_reviewed_by,
  rights_reviewed_at,
  is_public,
  updated_at
) ON public.media_assets TO factsport_v2_editorial_writer;

COMMIT;
