BEGIN;

-- Preserve the old Supabase match UUID as an alias without rewriting the
-- canonical V2 matches.id primary key or changing existing V2 foreign keys.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS legacy_match_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS matches_legacy_match_id_uidx
  ON public.matches (legacy_match_id)
  WHERE legacy_match_id IS NOT NULL;

COMMENT ON COLUMN public.matches.legacy_match_id IS
  'Optional legacy Supabase matches.id alias. V2 matches.id remains canonical; populated only by an approved identity reconciliation/import.';

COMMIT;
