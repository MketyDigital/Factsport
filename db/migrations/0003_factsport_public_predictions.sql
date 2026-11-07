-- Factsport V2 anonymous/public prediction foundation.
-- Apply only to isolated factsport_v2 after 0001_factsport_core.sql.
-- No legacy data is copied; no production database is touched.
BEGIN;

CREATE TABLE IF NOT EXISTS public.prediction_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_token_hash char(64) NOT NULL UNIQUE
    CHECK (visitor_token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  linked_at timestamptz,
  CONSTRAINT participant_link_timestamp CHECK (
    (user_id IS NULL AND linked_at IS NULL) OR
    (user_id IS NOT NULL AND linked_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS prediction_participants_user_idx
  ON public.prediction_participants (user_id)
  WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL
    REFERENCES public.prediction_participants(id) ON DELETE RESTRICT,
  -- Set only when the prediction is safely associated with a registered user.
  -- Kept nullable so a same-match claim conflict can be preserved without
  -- overwriting the account's existing prediction.
  user_id uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE RESTRICT,
  predicted_outcome text NOT NULL
    CHECK (predicted_outcome IN ('home', 'draw', 'away')),
  predicted_home_score integer,
  predicted_away_score integer,
  custom_predictions jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(custom_predictions) = 'object'),
  campaign_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(campaign_snapshot) = 'object'),
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SETTLED', 'VOID')),
  points_awarded integer NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  is_eligible_for_prize boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prediction_scores_pair CHECK (
    (predicted_home_score IS NULL AND predicted_away_score IS NULL) OR
    (predicted_home_score IS NOT NULL AND predicted_away_score IS NOT NULL AND
     predicted_home_score >= 0 AND predicted_away_score >= 0)
  ),
  CONSTRAINT prediction_participant_match_unique UNIQUE (participant_id, match_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS predictions_registered_user_match_unique
  ON public.predictions (user_id, match_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS predictions_match_status_idx
  ON public.predictions (match_id, status);
CREATE INDEX IF NOT EXISTS predictions_participant_submitted_idx
  ON public.predictions (participant_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS predictions_user_submitted_idx
  ON public.predictions (user_id, submitted_at DESC)
  WHERE user_id IS NOT NULL;

-- Preserve every anonymous-to-account association attempt and any same-match
-- conflict. Conflicting prediction rows remain intact and are not silently
-- overwritten or made prize-eligible.
CREATE TABLE IF NOT EXISTS public.prediction_participant_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL
    REFERENCES public.prediction_participants(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  outcome text NOT NULL
    CHECK (outcome IN ('linked', 'linked_with_conflicts', 'already_linked')),
  conflict_count integer NOT NULL DEFAULT 0 CHECK (conflict_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prediction_participant_claims_user_idx
  ON public.prediction_participant_claims (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.prediction_claim_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL
    REFERENCES public.prediction_participants(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE RESTRICT,
  anonymous_prediction_id uuid NOT NULL
    REFERENCES public.predictions(id) ON DELETE RESTRICT,
  existing_user_prediction_id uuid NOT NULL
    REFERENCES public.predictions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prediction_claim_conflict_unique
    UNIQUE (user_id, match_id, anonymous_prediction_id)
);

-- No browser/public role receives direct access. The dedicated API runtime
-- role and exact column/table grants are provisioned separately and verified
-- before this schema is used by application code.
REVOKE ALL ON TABLE
  public.prediction_participants,
  public.predictions,
  public.prediction_participant_claims,
  public.prediction_claim_conflicts
FROM PUBLIC;

COMMIT;
