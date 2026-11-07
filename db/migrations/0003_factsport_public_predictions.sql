-- Factsport V2 public free predictions with optional email marketing opt-in.
-- Apply only to isolated factsport_v2 after 0001_factsport_core.sql.
-- No legacy data is copied; no production database is touched.
BEGIN;

-- Email is collected only after a visitor explicitly chooses "Submit Prediction".
-- It is a contact detail for the free leaderboard/prediction workflow, not an account.
CREATE TABLE IF NOT EXISTS public.prediction_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address text NOT NULL,
  email_normalized text NOT NULL UNIQUE,
  email_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prediction_contact_email_length CHECK (
    char_length(email_address) BETWEEN 3 AND 254 AND
    char_length(email_normalized) BETWEEN 3 AND 254
  )
);

CREATE TABLE IF NOT EXISTS public.prediction_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_token_hash char(64) NOT NULL UNIQUE
    CHECK (visitor_token_hash ~ '^[0-9a-f]{64}$'),
  -- Multiple browser identities may share a contact email; email alone must
  -- never identify or transfer an anonymous participant or claim its history.
  contact_id uuid NOT NULL
    REFERENCES public.prediction_contacts(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  linked_at timestamptz,
  CONSTRAINT participant_display_name_length CHECK (
    display_name IS NULL OR char_length(display_name) BETWEEN 2 AND 40
  ),
  CONSTRAINT participant_link_timestamp CHECK (
    (user_id IS NULL AND linked_at IS NULL) OR
    (user_id IS NOT NULL AND linked_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS prediction_participants_user_idx
  ON public.prediction_participants (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS prediction_participants_contact_idx
  ON public.prediction_participants (contact_id);

CREATE TABLE IF NOT EXISTS public.predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL
    REFERENCES public.prediction_participants(id) ON DELETE RESTRICT,
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

-- A marketing subscription is a distinct purpose, never inferred from the
-- required email used to submit a prediction. Only explicit opt-in creates
-- a pending subscription; a separate confirmation may activate it.
CREATE TABLE IF NOT EXISTS public.marketing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.prediction_contacts(id) ON DELETE RESTRICT,
  channel text NOT NULL CHECK (channel = 'email'),
  purpose text NOT NULL CHECK (purpose = 'factsport_updates_and_offers'),
  status text NOT NULL DEFAULT 'pending_confirmation'
    CHECK (status IN ('pending_confirmation', 'subscribed', 'unsubscribed')),
  consent_version text NOT NULL,
  consent_text text NOT NULL,
  source text NOT NULL DEFAULT 'public_prediction_submission',
  consented_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  withdrawn_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_subscription_contact_purpose_unique
    UNIQUE (contact_id, channel, purpose),
  CONSTRAINT marketing_subscription_status_timestamps CHECK (
    (status = 'pending_confirmation' AND confirmed_at IS NULL AND withdrawn_at IS NULL) OR
    (status = 'subscribed' AND confirmed_at IS NOT NULL AND withdrawn_at IS NULL) OR
    (status = 'unsubscribed' AND withdrawn_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS marketing_subscriptions_status_idx
  ON public.marketing_subscriptions (status, consented_at DESC);

-- Append-only evidence of opt-in, confirmation and withdrawal; retain enough
-- evidence to honour withdrawals and demonstrate exactly what was agreed.
CREATE TABLE IF NOT EXISTS public.marketing_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL
    REFERENCES public.marketing_subscriptions(id) ON DELETE RESTRICT,
  event_type text NOT NULL
    CHECK (event_type IN ('opt_in', 'confirmation', 'withdrawal')),
  consent_version text NOT NULL,
  consent_text text NOT NULL,
  source text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_consent_events_subscription_idx
  ON public.marketing_consent_events (subscription_id, occurred_at DESC);

-- Preserve every anonymous-to-account association attempt and same-match conflict.
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

-- No browser/public role receives direct access. Dedicated API roles and exact
-- column/table grants are provisioned and verified separately.
REVOKE ALL ON TABLE
  public.prediction_contacts,
  public.prediction_participants,
  public.predictions,
  public.marketing_subscriptions,
  public.marketing_consent_events,
  public.prediction_participant_claims,
  public.prediction_claim_conflicts
FROM PUBLIC;

COMMIT;
