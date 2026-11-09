# M38 — Durable social dispatch claim and receipt API

Date: 2026-11-09
Branch: refactor/factsport-v2
Status: source implementation committed; CI verification running; scheduler, provider adapters, dispatcher Hyperdrive and credentials are not provisioned.

## Implemented

- Added withFactsportSocialDispatcherPostgres, a distinct Hyperdrive adapter for the factsport_v2_social_dispatcher identity. It does not fall back to the editorial writer, public reader or DATABASE_URL.
- Added fail-closed internal endpoints:
  - POST /api/internal/social/claim — requires the dispatch readiness flag, dedicated dispatcher Hyperdrive and a constant-time checked bearer secret. Claims up to ten due editorial posts using a transaction and FOR UPDATE SKIP LOCKED, records a lease, moves the publication to publishing, and inserts a started attempt.
  - POST /api/internal/social/result — records provider success, retryable/permanent failure or unknown_result; verifies lease owner, attempt number and expiry; applies bounded exponential retry up to six attempts; dead-letters permanent or ambiguous outcomes.
- Stale leases become unknown_result and are not blindly retried. This avoids duplicate social posts when a provider may have accepted a request but the response was lost.
- Due posts whose channel was disabled, scope/attestation was removed or attempt limit reached are moved to dead letter instead of remaining stuck.
- Revalidates all attached media at dispatch time. Assets must still be public, rights-reviewed, unexpired and attached to an approved published article. A channel must still have image capability enabled.
- Claim payload contains only public post content, public image URLs, provider/channel identifiers and a whitelist of non-secret channel routing metadata. It does not return raw channel settings or credentials.
- Added migration 0032_factsport_social_dispatcher_media_and_receipts.sql: a dispatcher-only projection of published rights-cleared media and column-scoped UPDATE privileges for delivery attempt receipts. The migration also permits the unknown_result attempt outcome.
- Added isolated regression coverage for auth readiness, dedicated database identity, transactional claiming, leases, media projection, retries and unknown-result handling.

## Scheduler and provider boundary

- Azure Logic Apps remains the owner-confirmed Day 1 scheduler/orchestrator. These endpoints are designed to be called by that workflow; no Cloudflare Cron duplicate was added.
- No Logic Apps workflow was enabled or provisioned. No provider adapter or provider credential is active yet.
- Direct Facebook and Telegram delivery and Buffer/Make through the Logic Apps adapter remain the provider integration targets. Provider-side idempotency, response parsing and private test-destination E2E must be completed before any channel is enabled.
- The scheduled-post outbox remains separate from the match-event outbox. The pure match-event detector is still not wired to canonical ingestion; this claim API currently handles editorial scheduled publications only.

## Validation

- Earlier isolated verification for the social attachment/capability slice passed on commit 8ca2e24832113e82a3990d5694c33545113f04ec (run 42558737483).
- Current claim/result source is undergoing fresh TypeScript, engine regression and native Worker verification after fixing test assertions. Do not claim this new dispatcher API has passed until the latest runs complete.
- Migration 0032 is committed but not applied. The dispatcher role/Hyperdrive, readiness flag, bearer secret and Logic Apps workflow do not exist in staging or production.

## Remaining acceptance

1. Configure Logic Apps with a secure recurrence trigger that calls the claim endpoint and processes each claimed item exactly once; keep the workflow disabled until connector references and secrets are configured.
2. Implement direct Facebook and Telegram actions, plus Buffer/Make adapter routing, using whitelisted channel config and secure Logic Apps connections.
3. Implement provider response normalization and post-ID/URL extraction. Ambiguous timeouts must report unknown_result, not retry automatically.
4. Add operator reconciliation UI for dead-letter/unknown-result items, controlled replay after external verification, and provider receipt history.
5. Run staging PostgreSQL migration/grant tests, dispatcher role identity checks, concurrent claim tests, expired lease tests, duplicate callback tests and private provider-destination E2E.
6. Keep all channel records disabled and FACTSPORT_SOCIAL_DISPATCH_READY unset until the full path is verified.

## Safety

No Logic Apps workflow, provider account, Facebook page, Telegram bot, Buffer profile, Make webhook, credential, production database, public route or live social post was changed.

- The claim path also rechecks provider readiness and, for image-bearing posts, provider image-delivery readiness at dispatch time. A channel that loses readiness is left queued rather than claimed; image-bearing posts are never sent through a channel whose image capability is unverified.
