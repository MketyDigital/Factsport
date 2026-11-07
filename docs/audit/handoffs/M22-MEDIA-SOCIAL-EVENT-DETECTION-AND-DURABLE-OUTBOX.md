# M22 — Deterministic Media match-event detection and durable delivery boundary

Date: 2026-11-07
Branch: `refactor/factsport-v2`
Status: pure detector and schema implemented; not yet wired to the live ingestion writer or provider dispatcher.

## Implemented

- `lib/social-match-event-policy.cjs` is a pure Media-domain transition detector with no database, provider or network side effects.
- It preserves the legacy event families: goals, lineups, kickoff, full-time, half-time, VAR overturn and penalty awarded.
- It preserves terminal-to-terminal suppression, full-time transitions, score-reduction/VAR handling, score increases, penalty additions, half-time transitions, kickoff transitions and full-XI detection.
- Goal and penalty freshness checks are retained.
- Dedupe keys are deterministic and include stable provider event IDs when available; score/time/player fallback fingerprints are used where provider IDs are absent.
- It strictly parses non-negative integer scores. A missing or malformed home/away score is unknown, never silently coerced to zero, and cannot trigger goal/VAR/penalty score-comparison events.
- It emits a normalized match snapshot plus event detail and a durable dedupe key. It does not publish anything.

## Durable schema

Migration `0016_factsport_media_social_event_outbox.sql` creates:

- `media_social_match_events`: one canonical detected event per match/event identity, source match version, payload, policy snapshot and lifecycle state.
- `media_social_match_deliveries`: one independently retryable delivery per event/channel, immutable content snapshot, unique idempotency key, claim availability, lease, provider receipt and error fields.
- `media_social_match_delivery_attempts`: append-only attempt outcome history, including an `unknown_result` outcome for ambiguous provider timeouts.

This is separate from the editorial scheduled-post outbox and attempt table. Match event fan-out and editorial scheduled publications are both Media distribution, but they are different event sources and state machines.

## Permission boundary

- `factsport_v2_media_automation_writer`: read-only access to canonical matches and Media policy/config; may insert detected event and per-channel delivery rows. It cannot call providers, read Prediction data or modify canonical match rows.
- `factsport_v2_social_dispatcher`: may claim/update delivery work and record provider attempts; it has no match-table, editorial-article, Prediction or settlement write access.
- `factsport_v2_editorial_writer` remains limited to CMS, social configuration and editorial scheduled-post preparation; it is not the match-event worker or provider dispatcher.

All three role names are migration prerequisites and must be provisioned as independent NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS logins with bounded connection limits and separate Hyperdrive bindings before applying the relevant grant migrations.

## Not yet implemented / activation gates

1. Wire the detector into the canonical Media match snapshot commit path. The event must be enqueued only after the canonical match update commits; do not call the detector from frontend polling.
2. Load the versioned VIP/event routing policy from migration 0015 and snapshot the exact routes, templates, audience decision and policy version into each event/delivery.
3. Render channel-specific copy from the legacy placeholder contract while preserving stream-aware CTA and competition-stakes text.
4. Implement a durable claim loop using transactions and `FOR UPDATE SKIP LOCKED`, leases, stale-lease recovery, bounded exponential backoff and dead-letter review.
5. Implement Buffer, Meta, Make and Telegram provider adapters with secrets bound only to the dispatcher Worker. No credential values belong in PostgreSQL or browser-readable settings.
6. Implement provider idempotency/receipt reconciliation. An ambiguous network timeout must become `unknown_result`, not an automatic blind retry that could double-post.
7. Keep the old image-off setting until explicitly changed; R2 artwork can be introduced only as an approved enhancement.
8. Keep URL indexing separate and retryable.
9. Run offline parity fixtures against archived legacy source and sanitized representative old/new match records; then staging-only delivery to private test destinations.
10. Keep all event routing and the global automation switch disabled until the above gates pass.

## Validation

The V2 engine regression suite, the new pure event-policy tests, TypeScript check and PostgreSQL migration inventory passed on the latest verified CI run. These are source-level checks; migration 0016 has not been applied, the two new worker roles/Hyperdrives do not yet exist, no live ingestion integration is wired, and no social provider has been called.
