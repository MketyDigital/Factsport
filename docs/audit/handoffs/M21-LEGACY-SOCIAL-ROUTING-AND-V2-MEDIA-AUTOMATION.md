# M21 — Legacy match-event social routing and V2 Media automation preservation

Date: 2026-11-07
Branch: `refactor/factsport-v2`
Status: legacy source audited and archived; V2 routing schema added; provider dispatcher deliberately not activated.

## Ownership and separation

This is Media functionality. It covers match-event social notifications and the Media publishing/automation workflow. It does not own Prediction campaigns, prediction settlement, scoring, prizes or monthly winner operations. Article social scheduling remains a separate workflow from match-event notifications.

## Legacy source retained

The V2 branch's prior `app/api/social/route.ts` source has been preserved verbatim at:

- `docs/audit/legacy-source/api-social-route-v1.ts`

The active V2 `POST /api/social` now returns HTTP 410 with `V2_SOCIAL_DISPATCHER_NOT_PROVISIONED`. It no longer creates a Supabase service-role client or calls Buffer, Meta, Make, Telegram, legacy storage or the URL-indexing endpoint. This is intentional fail-closed behavior while the V2 dispatcher is not ready; it is not a claim that the old behaviour has already been replaced.

## Legacy event detection and data rules to preserve/upgrade

The archived source is the evidence for these behaviours:

- It consumes match old/new row snapshots and evaluates status transitions, scores, match events and lineups.
- Event families: `goals`, `lineups`, `kickoff`, `fulltime`, `halftime`, `var_overturn`, and `penalty_awarded`.
- Goal event identity includes the new total score; VAR-overturn identity includes the new total; penalty identity includes penalty-event count. This distinguishes successive score/penalty events for the same match.
- It ignores late corrections when both old and new statuses are terminal.
- It avoids stale goal/penalty commentary; when a score changes before the match event array catches up, it waits eight seconds and re-reads the event array.
- It emits scorer/time context, league/round/group stakes, team abbreviations and hashtags, match-centre links, and video/audio stream-aware CTA copy.
- Full-time, kickoff, half-time, goal and lineup events can generate Open Graph artwork. The archived code then deliberately disables all outgoing images via an explicit temporary owner-requested override. V2 defaults `images_enabled=false`; do not re-enable artwork until that owner preference is explicitly changed.
- Lineup routing is specially normalized: only Buffer X1, Meta FB1 and Make webhook 1 may be active for lineups; all other destinations are forced off.
- The legacy VIP audience contains hardcoded team and league lists plus configurable additions. If the match is not VIP, it checks today's matches: if any VIP fixture exists, it suppresses the non-VIP match; if none exists, only the first match of the day is the fallback.
- Legacy "today" uses UTC via `toISOString().split('T')[0]`. V2 stores timezone explicitly (default UTC) rather than silently changing the rule.
- Templates support `[HOME]`, `[AWAY]`, `[H_SCORE]`, `[A_SCORE]`, `[LINK]`, `[TIME]`, `[SCORER]`, `[STATUS]`, `[HASHTAGS]`, `[STAKES]`, `[ROUND]`, `[GROUP]`, `[CTA]` and `[PRE_CTA]`.
- Legacy text routes include Buffer profile targets, direct Meta Facebook page targets, Make webhooks and Telegram general channels. The Make payload has separate Facebook/X/Buffer text fields.
- Buffer has a special text-only retry for lineup posts when image-enabled delivery fails; Make retries after stripping the image; Meta photo delivery falls back to feed text where implemented. Telegram sends HTML parse-mode messages.
- Successful route handling also requests URL indexing for the match URL. V2 should make this a separate, retryable Media indexing job, not an untracked side effect.

## Legacy default route matrix recorded in migration 0015

The seeded route rows reproduce the legacy `SAFETY_MAP` defaults. All seeded channels are disabled, and the global automation setting is disabled, so migration does not start sending posts.

| Event | Buffer X1 | Buffer X2 | Buffer FB1 | Buffer FB2 | Meta FB1 | Meta FB2 | Make 1 | Make 2 | Telegram |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Goal | off | off | off | off | on | off | on | off | off |
| Lineups | on | off | off | off | on | off | on | off | off |
| Kickoff | off | off | off | off | on | off | on | off | off |
| Full-time | off | off | off | off | on | off | on | off | off |
| Half-time | off | off | off | off | on | off | off | off | off |
| VAR overturn | off | off | off | off | on | off | off | off | off |
| Penalty awarded | off | off | off | off | on | off | off | off | off |

Migration `0015_factsport_social_event_automation.sql` also seeds the legacy VIP team/league names, records the first-match fallback, timezone and images-disabled setting, and provides editable event-route and event-template tables. It creates disabled channel identities only; it does not import live credentials or unknown custom templates.

## V2 improvements required before delivery

1. Replace isolate-local Set + 90-second timeout dedupe with durable event identity and transactional outbox uniqueness, using canonical match ID + normalized event key + score/penalty identity + provider event ID when available.
2. Make event extraction a pure tested Media domain service; reject malformed/missing scores rather than coercing unknown values to zero.
3. Persist one event decision per event, then fan out independently per channel. A failure at one provider must not block other channels.
4. Use provider adapters with server-only secret bindings; never put tokens, page access tokens, Buffer tokens, Make webhook URLs or bot tokens in the settings tables or browser payload.
5. Implement bounded retry/backoff, per-provider rate limits, lease recovery, delivery receipts, error classification, dead-letter review and idempotency. Avoid blind retry after ambiguous provider timeout unless provider-side idempotency/receipt reconciliation exists.
6. Store channel-specific copy/template snapshots on the outbox event so edits to future templates do not rewrite an already queued event.
7. Reproduce VIP selection and fallback exactly first, then add a versioned/admin-reviewed policy change mechanism; record the policy version used for each event.
8. Generate media through the V2 R2 path only when enabled; preserve current text-only behavior until approved. Preserve Buffer/Make fallback semantics where they remain supported.
9. Move URL indexing to a separate retryable job with its own provider state.
10. Audit event source provenance and ordering: the background live snapshot writer should enqueue events only after canonical match state is committed; frontend fast polling must never send social notifications.

## Current status and no-go conditions

- V2 schema exists for channel identities, event route defaults, templates, VIP teams/leagues and global automation settings.
- All default channels and global automation start disabled.
- The old route source is archived; active V2 route is fail-closed.
- No provider credentials were read or migrated. Legacy custom `social_config` templates, VIP additions, channel account IDs, webhook URLs and tokens still require an authorized export/field mapping from the legacy settings source. Never copy secrets into Git or PostgreSQL.
- No social post was sent by this implementation.
- Do not enable event routes until dispatcher role/binding, secret store, provider adapters, durable claims and staged parity tests exist.
