-- Require a durable human approval, cleared rights approval and a cleared video
-- asset before a TV post can enter the publisher outbox. This does not dispatch.
BEGIN;

CREATE OR REPLACE FUNCTION public.factsport_tv_enforce_publish_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  episode_status text;
  episode_revision integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending' THEN
      RAISE EXCEPTION 'TV publish outbox entries must begin pending';
    END IF;

    SELECT status, revision INTO episode_status, episode_revision
      FROM public.factsport_tv_episodes
      WHERE id = NEW.episode_id
      FOR SHARE;
    IF NOT FOUND OR episode_status NOT IN ('approved', 'publish_queued')
        OR episode_revision <> NEW.revision THEN
      RAISE EXCEPTION 'TV episode is not approved for this revision';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.factsport_tv_approvals approval
      WHERE approval.episode_id = NEW.episode_id
        AND approval.revision = NEW.revision
        AND approval.gate = 'publish'
        AND approval.decision = 'approved'
        AND approval.actor_user_id = NEW.approved_by
        AND approval.created_at <= NEW.approved_at
    ) THEN
      RAISE EXCEPTION 'TV publish approval is missing';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.factsport_tv_approvals approval
      WHERE approval.episode_id = NEW.episode_id
        AND approval.revision = NEW.revision
        AND approval.gate = 'rights'
        AND approval.decision = 'approved'
        AND NOT EXISTS (
          SELECT 1 FROM public.factsport_tv_approvals later
          WHERE later.episode_id = approval.episode_id
            AND later.revision = approval.revision
            AND later.gate = 'rights'
            AND later.decision <> 'approved'
            AND later.created_at > approval.created_at
        )
    ) THEN
      RAISE EXCEPTION 'TV rights approval is missing or revoked';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.factsport_tv_assets asset
      WHERE asset.episode_id = NEW.episode_id
        AND asset.asset_kind = 'video'
        AND asset.rights_status = 'cleared'
    ) THEN
      RAISE EXCEPTION 'TV publishable video asset is missing or uncleared';
    END IF;

    RETURN NEW;
  END IF;

  -- Dispatch workers may advance delivery state, but may not rewrite the
  -- approved episode, destination, content package or human approval.
  IF NEW.episode_id IS DISTINCT FROM OLD.episode_id
      OR NEW.revision IS DISTINCT FROM OLD.revision
      OR NEW.platform IS DISTINCT FROM OLD.platform
      OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
      OR NEW.package IS DISTINCT FROM OLD.package
      OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
      OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION 'TV publish package and approval are immutable';
  END IF;

  IF OLD.status IN ('completed', 'dead_letter', 'cancelled') THEN
    RAISE EXCEPTION 'TV publish outbox entry is terminal';
  END IF;
  IF NEW.attempts < OLD.attempts OR NEW.attempts > OLD.attempts + 1 THEN
    RAISE EXCEPTION 'TV publish attempt counter must advance by at most one';
  END IF;
  IF NOT (
    (OLD.status = 'pending' AND NEW.status IN ('processing', 'cancelled')) OR
    (OLD.status = 'retry' AND NEW.status IN ('processing', 'cancelled')) OR
    (OLD.status = 'processing' AND NEW.status IN ('retry', 'completed', 'dead_letter', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'TV publish state transition is invalid';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.factsport_tv_enforce_publish_guard() FROM PUBLIC;
DROP TRIGGER IF EXISTS factsport_tv_publish_guard ON public.factsport_tv_publish_outbox;
CREATE TRIGGER factsport_tv_publish_guard
  BEFORE INSERT OR UPDATE ON public.factsport_tv_publish_outbox
  FOR EACH ROW EXECUTE FUNCTION public.factsport_tv_enforce_publish_guard();

-- Humans may enqueue after approval. Only the dispatcher can update delivery
-- state and receipts; content and approval columns stay immutable.
REVOKE UPDATE ON public.factsport_tv_publish_outbox
  FROM factsport_v2_editorial_writer, factsport_v2_social_dispatcher;
GRANT SELECT, INSERT ON public.factsport_tv_publish_outbox
  TO factsport_v2_editorial_writer;
GRANT SELECT ON public.factsport_tv_publish_outbox
  TO factsport_v2_social_dispatcher;
GRANT UPDATE (status, attempts, available_at, lease_owner, lease_expires_at,
  provider_request_id, provider_post_id, provider_post_url,
  last_error_code, last_error_message, updated_at)
  ON public.factsport_tv_publish_outbox TO factsport_v2_social_dispatcher;

COMMIT;
