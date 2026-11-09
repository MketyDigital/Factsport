-- Narrow anonymous Prediction submission capability.
-- Apply only after 0001 and 0003 on an isolated Factsport V2 database.
-- The API role receives EXECUTE on one function, never direct table access.
BEGIN;


-- Explicit rules/privacy acceptance is tied to the actual prediction, not to
-- marketing consent. Preserve the exact versioned text the visitor accepted.
CREATE TABLE public.prediction_rule_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.prediction_participants(id) ON DELETE RESTRICT,
  prediction_id uuid NOT NULL UNIQUE REFERENCES public.predictions(id) ON DELETE RESTRICT,
  rules_version text NOT NULL CHECK (char_length(rules_version) BETWEEN 1 AND 32),
  rules_text text NOT NULL CHECK (char_length(rules_text) BETWEEN 10 AND 4000),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'public_prediction_submission'
);
REVOKE ALL ON TABLE public.prediction_rule_acceptances FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.submit_public_prediction(
  p_visitor_token_hash text,
  p_email_address text,
  p_display_name text,
  p_match_id uuid,
  p_predicted_outcome text,
  p_rules_version text,
  p_rules_text text,
  p_marketing_opt_in boolean,
  p_marketing_consent_version text,
  p_marketing_consent_text text,
  p_predicted_home_score integer,
  p_predicted_away_score integer
)
RETURNS TABLE (prediction_id uuid, duplicate boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_participant_id uuid;
  v_contact_id uuid;
  v_prediction_id uuid;
  v_status text;
  v_match_date timestamptz;
  v_email text;
  v_email_normalized text;
  v_display_name text;
  v_subscription_id uuid;
  v_duplicate boolean := false;
BEGIN
  IF p_visitor_token_hash IS NULL
     OR p_visitor_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_visitor_token' USING ERRCODE = '22023';
  END IF;
  IF p_match_id IS NULL THEN
    RAISE EXCEPTION 'invalid_match' USING ERRCODE = '22023';
  END IF;
  IF p_predicted_outcome IS NULL
     OR p_predicted_outcome NOT IN ('home', 'draw', 'away') THEN
    RAISE EXCEPTION 'invalid_outcome' USING ERRCODE = '22023';
  END IF;
  IF p_rules_version IS NULL OR pg_catalog.char_length(p_rules_version) NOT BETWEEN 1 AND 32
     OR p_rules_text IS NULL OR pg_catalog.char_length(p_rules_text) NOT BETWEEN 10 AND 4000 THEN
    RAISE EXCEPTION 'rules_acceptance_required' USING ERRCODE = '22023';
  END IF;
  IF p_marketing_opt_in IS NULL THEN
    RAISE EXCEPTION 'invalid_marketing_consent' USING ERRCODE = '22023';
  END IF;
  IF p_marketing_opt_in AND (
    p_marketing_consent_version IS NULL
    OR pg_catalog.char_length(p_marketing_consent_version) NOT BETWEEN 1 AND 32
    OR p_marketing_consent_text IS NULL
    OR pg_catalog.char_length(p_marketing_consent_text) NOT BETWEEN 10 AND 1000
  ) THEN
    RAISE EXCEPTION 'invalid_marketing_consent' USING ERRCODE = '22023';
  END IF;

  IF (p_predicted_home_score IS NULL) <> (p_predicted_away_score IS NULL)
     OR p_predicted_home_score < 0 OR p_predicted_away_score < 0
     OR p_predicted_home_score > 99 OR p_predicted_away_score > 99 THEN
    RAISE EXCEPTION 'invalid_score_pair' USING ERRCODE = '22023';
  END IF;

  v_display_name := NULLIF(pg_catalog.btrim(p_display_name), '');
  IF v_display_name IS NOT NULL AND
     (pg_catalog.char_length(v_display_name) < 2 OR pg_catalog.char_length(v_display_name) > 40) THEN
    RAISE EXCEPTION 'invalid_display_name' USING ERRCODE = '22023';
  END IF;

  -- Serialize submissions from the same opaque browser identity.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_visitor_token_hash, 0)
  );

  -- A match row lock makes kickoff/status validation atomic with submission
  -- relative to match status/date updates by the ingestion pipeline.
  SELECT m.status, m.match_date
    INTO v_status, v_match_date
    FROM public.matches AS m
   WHERE m.id = p_match_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT pp.id, pp.contact_id
    INTO v_participant_id, v_contact_id
    FROM public.prediction_participants AS pp
   WHERE pp.visitor_token_hash = p_visitor_token_hash
   FOR UPDATE;

  -- Existing retries are recognized even after kickoff. A duplicate cannot
  -- alter the locked prediction, but may still submit a separate explicit
  -- marketing opt-in for the already-associated contact.
  IF v_participant_id IS NOT NULL THEN
    SELECT p.id INTO v_prediction_id
      FROM public.predictions AS p
     WHERE p.participant_id = v_participant_id
       AND p.match_id = p_match_id;
    v_duplicate := FOUND;
  END IF;

  IF NOT v_duplicate THEN
    IF pg_catalog.upper(COALESCE(v_status, '')) NOT IN ('SCHEDULED', 'PRE_MATCH')
       OR v_match_date <= pg_catalog.transaction_timestamp() THEN
      RAISE EXCEPTION 'prediction_closed' USING ERRCODE = '55000';
    END IF;

    IF v_participant_id IS NULL THEN
      v_email := pg_catalog.btrim(COALESCE(p_email_address, ''));
      v_email_normalized := pg_catalog.lower(v_email);
      IF pg_catalog.char_length(v_email) NOT BETWEEN 3 AND 254
         OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
        RAISE EXCEPTION 'valid_email_required' USING ERRCODE = '22023';
      END IF;

      INSERT INTO public.prediction_contacts (email_address, email_normalized)
      VALUES (v_email, v_email_normalized)
      ON CONFLICT (email_normalized) DO UPDATE
        SET email_address = EXCLUDED.email_address,
            updated_at = pg_catalog.transaction_timestamp()
      RETURNING id INTO v_contact_id;

      INSERT INTO public.prediction_participants (
        visitor_token_hash, contact_id, display_name, last_seen_at
      ) VALUES (
        p_visitor_token_hash, v_contact_id, v_display_name, pg_catalog.transaction_timestamp()
      )
      RETURNING id INTO v_participant_id;
    ELSE
      UPDATE public.prediction_participants
         SET last_seen_at = pg_catalog.transaction_timestamp(),
             display_name = COALESCE(v_display_name, display_name)
       WHERE id = v_participant_id;
    END IF;

    INSERT INTO public.predictions (
      participant_id, match_id, predicted_outcome,
      predicted_home_score, predicted_away_score,
      is_eligible_for_prize, locked_at
    ) VALUES (
      v_participant_id, p_match_id, p_predicted_outcome,
      p_predicted_home_score, p_predicted_away_score,
      false, v_match_date
    )
    ON CONFLICT (participant_id, match_id) DO NOTHING
    RETURNING id INTO v_prediction_id;

    IF v_prediction_id IS NULL THEN
      SELECT p.id INTO v_prediction_id
        FROM public.predictions AS p
       WHERE p.participant_id = v_participant_id
         AND p.match_id = p_match_id;
      v_duplicate := true;
    ELSE
      INSERT INTO public.prediction_rule_acceptances (
        participant_id, prediction_id, rules_version, rules_text
      ) VALUES (
        v_participant_id, v_prediction_id, p_rules_version, p_rules_text
      );
    END IF;
  END IF;

  -- Marketing is a separate, optional purpose. Only an explicit affirmative
  -- opt-in creates a pending subscription; no send is authorized here.
  IF p_marketing_opt_in THEN
    INSERT INTO public.marketing_subscriptions (
      contact_id, channel, purpose, status,
      consent_version, consent_text, source, consented_at
    ) VALUES (
      v_contact_id, 'email', 'factsport_updates_and_offers',
      'pending_confirmation', p_marketing_consent_version,
      p_marketing_consent_text, 'public_prediction_submission',
      pg_catalog.transaction_timestamp()
    )
    ON CONFLICT (contact_id, channel, purpose) DO UPDATE
      SET status = 'pending_confirmation',
          consent_version = EXCLUDED.consent_version,
          consent_text = EXCLUDED.consent_text,
          source = EXCLUDED.source,
          consented_at = EXCLUDED.consented_at,
          confirmed_at = NULL,
          withdrawn_at = NULL,
          updated_at = pg_catalog.transaction_timestamp()
    RETURNING id INTO v_subscription_id;

    INSERT INTO public.marketing_consent_events (
      subscription_id, event_type, consent_version, consent_text, source, occurred_at
    ) VALUES (
      v_subscription_id, 'opt_in', p_marketing_consent_version,
      p_marketing_consent_text, 'public_prediction_submission',
      pg_catalog.transaction_timestamp()
    );
  END IF;

  RETURN QUERY SELECT v_prediction_id, v_duplicate;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_public_prediction(
  text, text, text, uuid, text, text, text, boolean, text, text, integer, integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_public_prediction(
  text, text, text, uuid, text, text, text, boolean, text, text, integer, integer
) TO factsport_v2_prediction_api;


-- Return only whether the presented first-party visitor token already maps
-- to a participant. No participant ID, email or prediction history is exposed.
CREATE OR REPLACE FUNCTION public.get_public_prediction_visitor_state(
  p_visitor_token_hash text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $visitor_state$
  SELECT COALESCE(
    p_visitor_token_hash IS NOT NULL
    AND pg_catalog.char_length(p_visitor_token_hash) = 64
    AND p_visitor_token_hash !~ '[^0-9a-f]'
    AND EXISTS (
      SELECT 1
      FROM public.prediction_participants AS participant
      WHERE participant.visitor_token_hash = p_visitor_token_hash
    ),
    false
  );
$visitor_state$;

REVOKE ALL ON FUNCTION public.get_public_prediction_visitor_state(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_prediction_visitor_state(text)
  TO factsport_v2_prediction_api;

-- Privacy-preserving rate-limit counters. Only keyed hashes are stored; raw
-- visitor tokens and client IP addresses never enter this table.
CREATE TABLE public.prediction_submission_rate_limits (
  scope text NOT NULL CHECK (scope IN ('visitor', 'network')),
  key_hash char(64) NOT NULL CHECK (pg_catalog.char_length(key_hash) = 64 AND key_hash !~ '[^0-9a-f]'),
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  PRIMARY KEY (scope, key_hash, window_started_at)
);

REVOKE ALL ON TABLE public.prediction_submission_rate_limits FROM PUBLIC;
CREATE INDEX prediction_submission_rate_limits_expiry_idx
  ON public.prediction_submission_rate_limits (window_started_at);

CREATE OR REPLACE FUNCTION public.consume_public_prediction_rate_limit(
  p_scope text,
  p_key_hash text,
  p_window_seconds integer,
  p_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $rate_limit$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  IF p_scope IS NULL OR p_scope NOT IN ('visitor', 'network')
     OR p_key_hash IS NULL OR pg_catalog.char_length(p_key_hash) <> 64 OR p_key_hash ~ '[^0-9a-f]'
     OR p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 1 AND 3600
     OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'invalid_rate_limit_parameters' USING ERRCODE = '22023';
  END IF;

  -- Opportunistically prune expired buckets without storing source identifiers.
  IF pg_catalog.mod(pg_catalog.hashtextextended(p_key_hash, 0), 100) = 0 THEN
    DELETE FROM public.prediction_submission_rate_limits
     WHERE window_started_at < pg_catalog.transaction_timestamp() - INTERVAL '24 hours';
  END IF;

  v_window_start := pg_catalog.to_timestamp(
    pg_catalog.floor(
      EXTRACT(EPOCH FROM pg_catalog.transaction_timestamp()) / p_window_seconds
    ) * p_window_seconds
  );

  INSERT INTO public.prediction_submission_rate_limits (
    scope, key_hash, window_started_at, request_count
  ) VALUES (
    p_scope, p_key_hash, v_window_start, 1
  )
  ON CONFLICT (scope, key_hash, window_started_at) DO UPDATE
    SET request_count = LEAST(
      public.prediction_submission_rate_limits.request_count + 1,
      p_limit + 1
    )
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$rate_limit$;

REVOKE ALL ON FUNCTION public.consume_public_prediction_rate_limit(
  text, text, integer, integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.consume_public_prediction_rate_limit(
  text, text, integer, integer
) TO factsport_v2_prediction_api;

COMMIT;
 THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.prediction_participants AS participant
      WHERE participant.visitor_token_hash = p_visitor_token_hash
    )
  END;
$visitor_state$;

REVOKE ALL ON FUNCTION public.get_public_prediction_visitor_state(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_prediction_visitor_state(text)
  TO factsport_v2_prediction_api;

-- Privacy-preserving rate-limit counters. Only keyed hashes are stored; raw
-- visitor tokens and client IP addresses never enter this table.
CREATE TABLE public.prediction_submission_rate_limits (
  scope text NOT NULL CHECK (scope IN ('visitor', 'network')),
  key_hash char(64) NOT NULL CHECK (pg_catalog.char_length(key_hash) = 64 AND key_hash !~ '[^0-9a-f]'),
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  PRIMARY KEY (scope, key_hash, window_started_at)
);

REVOKE ALL ON TABLE public.prediction_submission_rate_limits FROM PUBLIC;
CREATE INDEX prediction_submission_rate_limits_expiry_idx
  ON public.prediction_submission_rate_limits (window_started_at);

CREATE OR REPLACE FUNCTION public.consume_public_prediction_rate_limit(
  p_scope text,
  p_key_hash text,
  p_window_seconds integer,
  p_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $rate_limit$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  IF p_scope IS NULL OR p_scope NOT IN ('visitor', 'network')
     OR p_key_hash IS NULL OR pg_catalog.char_length(p_key_hash) <> 64 OR p_key_hash ~ '[^0-9a-f]'
     OR p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 1 AND 3600
     OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'invalid_rate_limit_parameters' USING ERRCODE = '22023';
  END IF;

  -- Opportunistically prune expired buckets without storing source identifiers.
  IF pg_catalog.mod(pg_catalog.hashtextextended(p_key_hash, 0), 100) = 0 THEN
    DELETE FROM public.prediction_submission_rate_limits
     WHERE window_started_at < pg_catalog.transaction_timestamp() - INTERVAL '24 hours';
  END IF;

  v_window_start := pg_catalog.to_timestamp(
    pg_catalog.floor(
      EXTRACT(EPOCH FROM pg_catalog.transaction_timestamp()) / p_window_seconds
    ) * p_window_seconds
  );

  INSERT INTO public.prediction_submission_rate_limits (
    scope, key_hash, window_started_at, request_count
  ) VALUES (
    p_scope, p_key_hash, v_window_start, 1
  )
  ON CONFLICT (scope, key_hash, window_started_at) DO UPDATE
    SET request_count = LEAST(
      public.prediction_submission_rate_limits.request_count + 1,
      p_limit + 1
    )
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$rate_limit$;

REVOKE ALL ON FUNCTION public.consume_public_prediction_rate_limit(
  text, text, integer, integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.consume_public_prediction_rate_limit(
  text, text, integer, integer
) TO factsport_v2_prediction_api;

COMMIT;
