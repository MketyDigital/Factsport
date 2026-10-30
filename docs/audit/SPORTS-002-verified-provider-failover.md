# SPORTS-002 — ESPN degradation detection and conditional football-data.org live failover
Date: 2026-10-30 | Decision: USER APPROVED OPTION C
Status: design + isolated pure code **committed**, NOT integrated or production-tested.

## Exact operating principle
- football-data.org is Factsport's primary free-tier fixture/competition ingestion engine; ESPN covers free-tier fixture gaps.
- ESPN is preferred for fast LIVE data whenever an ESPN mapping exists, including FD-origin fixtures.
- FD delayed LIVE updates remain authoritative for **unmatched** FD fixtures.
- For a fixture with a valid ESPN mapping, FD LIVE fallback is permitted **only when a genuine ESPN upstream degradation is independently established**, not when our own Cloudflare scheduler, worker, DB, connection, network edge, queue, mapping or rate limiter is malfunctioning.
- Restore ESPN live priority as soon as a valid fresh ESPN response returns. Do not rematch, overwrite or delete stable match IDs, prediction FKs, events or editorial data in failover.

## Health model: do not infer upstream outage from "no update"
Separate *four* indicators:
1. **ESPN response health**: real upstream HTTP/timeout/parse errors, consistently missing an expected event in otherwise healthy league responses, provider freshness metadata; distinguish real non-live scoreboard stagnation (a 0-0 match may stay unchanged) from failure. Confirm with multiple independent requests/observations and healthy control fixtures/leagues. A transient 429 may be rate limiting or our usage problem; evaluate quotas/headers before classifying.
2. **Local pipeline health**: scheduled worker has fired on time, no queue backlog, no high error rate or exceptions, Cloudflare egress/DNS healthy, DB read/write healthy, mapping and league code verified, provider credentials valid, clock synced and ingestion pipeline processing other fixtures. Worker failure, missing ENV and mapping failure never justify an ESPN-outage classification.
3. **Per-match linkage**: existing verified espn_id/canonical match id, correct competition/teams, valid kickoff and live state. Matchmaker mismatch is a separate reconciliation case, not an ESPN service outage.
4. **Alternative FD feed validity**: same canonical match with verified FD ID, actual *provider observation timestamp* (not just our fetch/write timestamp), score validity, status coherence, and data freshness relative to last accepted ESPN state. Without a reliable comparable source observation timestamp, do not auto-override a matched ESPN fixture.

## Proposed operational state machine (not deployed)
- ESPN_ACTIVE: ESPN linked and healthy; FD live observations may be kept for verification but must not override.
- ESPN_SUSPECT: apparent delay or one failed poll; preserve ESPN score; collect diagnostics and independent probes.
- ESPN_CONFIRMED_DEGRADED: minimum failures and elapsed time reached while our pipeline is healthy and independent ESPN upstream failure is confirmed. Avoid provider-switch ping-pong.
- FD_TEMPORARY: accept FD LIVE only if candidate is valid and no older than last accepted observation; keep ESPN match mapping and rich events untouched, mark current live-score provenance and freshness for display. Do not infer "updated" because the score has changed.
- ESPN_RECOVERY: require genuinely valid fresh ESPN event for the correct match; stop FD live writes immediately, allow ESPN to resume, prevent old ESPN responses from regressing accepted FD score or FT result. Exact recovery hysteresis and event-source timestamps require instrumentation and testing.
- FINAL_CHECK: FD verifies FT; disagreement detection and scoring/settlement separate from live failover. Never automatically award points on incomplete, abandoned, disputed or unverified final data.

## Pure regression guard added
`lib/match-source-policy.cjs` provides `canTemporarilyFallback(context)` and `decideScoreUpdate(match, update, provider, context)`. This is **not yet connected** to any scheduler or route. Fail-closed requirements:
- upstreamFailureVerified=true, localPipelineHealthy=true, matchLinkHealthy=true, ESPN not marked healthy
- no fewer than three verified failures AND at least 180 seconds since the last successful ESPN response AND since the first independently verified failure
- timestamps must be numeric and chronological; FD candidate observation time must be available, not after now or older than current accepted observation; stale >15m snapshot rejected by default (this 15m cap is a provisional design threshold, not a guarantee of FD latency)
- LIVE status + numeric nonnegative scores; score decreases held for review; finished state cannot regress
- any health evidence missing returns IGNORE for ESPN-linked FD live updates
- new valid ESPN input remains accepted as preferred provider; an external orchestrator must update health and stop fallback when ESPN recovers

## Thresholds and system observability
Three verified failures / 180 seconds is an *initial proposed default only*, not based on the current scheduling frequency. Previous GitHub matchmaker schedule ran twice daily and cannot supply three failure signals in three minutes. Before enabling production fallback:
- explicitly choose ESPN/live poll schedule, per-provider request quota, per-league cadence, and optional adaptive polling
- log attempted_at, fetched_at, provider_observed_at, expected_event_id, upstream HTTP classification, mapping result, worker/job success, queue depth, DB health, response freshness, region, last successful ESPN snapshot, failover transitions and reconciliation, with NO credentials
- require authoritative, reproducible outage classification: healthy local checks plus independent ESPN failure probes. If no independent signals, remain ESPN_SUSPECT and hold last trusted state.
- decide threshold and whether 15m fallback cap suits intended user-visible delayed feed; avoid false freshness.
- handle deliberate empty event arrays, delayed provider publish, provider rate limiting, maintenance windows and Cloudflare outages separately.

## Implementation/test gate
Test module and regression cases are committed but **Node execution is not yet verified**.
Next: execute offline Node tests in a verified checkout; collect sanitized representative responses (no users or API keys); implement a durable, centralized per-match health state (PostgreSQL/queue or equivalent), transactional compare-and-set with provider observation metadata, recovery fencing and an outbox for social notifications; only then opt in on staging.
Do not invoke old live endpoints or change production credentials, cron jobs or Supabase schema.

## Outstanding owner choice
Whether 180s + 3 independently verified failures is right depends on actual ESPN polling cadence; keep adjustable and require staging evidence before production enablement. The owner approved **conditional fallback**, not a specific duration.
