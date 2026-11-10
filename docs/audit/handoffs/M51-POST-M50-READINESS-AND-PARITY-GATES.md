# M51 — Post-M50 audit checkpoint and next implementation gates

Date: 2026-11-10
Branch: `refactor/factsport-v2`
Status: source-backed audit checkpoint only. No production write, Azure migration, Cloudflare Stream provisioning, AdSense enablement or cutover.

## Source evidence reviewed

- `docs/audit/ROADMAP.md` (governing roadmap and explicit production pause)
- `docs/audit/FULL-SYSTEM-2026-11-06.md` (legacy and v2 security/operational risks)
- `docs/audit/handoffs/M44-LEGACY-PREDICTION-PARITY-MATRIX.md` (sanitized legacy SQL behavioral evidence)
- `docs/audit/handoffs/M46-ADSENSE-AND-SEO-FAIL-CLOSED-GATES.md`
- `docs/audit/handoffs/M49-PREDICTION-SUBMISSION-PREFLIGHT.md` (implementation plus verification closeout)
- `docs/audit/handoffs/M50-RESUMABLE-CLOUDFLARE-STREAM-UPLOADS.md` (implementation plus verification closeout)
- `app/api/admin/media/videos/tus-upload/route.ts`
- `app/admin/media/MediaVideoLibrary.tsx`
- Branch comparison `main...refactor/factsport-v2` via GitHub: the refs have diverged. Do not merge/cut over without targeted reconciliation and branch protections.

## Corrections to stale audit snapshots

M44 predates the M49 public free-prediction implementation. Its statements that there is no public submit API, no visitor cookie, and no scoped Prediction API role are historical snapshots, not the current implementation state. M49 records the scoped SQL function, dedicated role expectations, opaque visitor cookie, bounded API, optional consent and successful disposable PostgreSQL verification. **Do not mark Prediction parity complete:** campaigns, scored settlement, VIP, reward eligibility, identity claims, confirmation/unsubscribe, and live browser verification remain open.

M50 records 226 regression tests, typecheck, native vinext build, protected Cloudflare application staging and disposable PostgreSQL migration chain passing at the documented commits. This is not proof of a real Cloudflare Stream TUS transfer, interrupted upload resume, provider header/CORS behavior, Azure database activation, rights approval or public signed playback.

## Next verification — Media VOD provider integration (highest readiness dependency)

1. Keep `FACTSPORT_MEDIA_VIDEO_SCHEMA_READY` and `FACTSPORT_STREAM_VIDEO_READY` disabled outside an owner-approved isolated staging environment.
2. Verify the real provider-issued `stream-media-id` shape and the `Location` URL contract; confirm Cloudflare allows browser POST creation followed by cross-origin TUS HEAD/PATCH from the actual staging origin.
3. Verify browser exposure of required response headers, including the app's `X-Factsport-Video-Asset-Id` on creation and provider TUS headers; record any required `Access-Control-Expose-Headers` and allowed-origin configuration.
4. Test under-200MB direct uploads and 200MB+ TUS uploads with 50MiB chunks. Deliberately interrupt mid-transfer; reload, reselect the same file, and confirm offset-based resume and one asset record.
5. Check one-hour TUS expiry, 55-minute client resume window, missing local storage, wrong file metadata, failed provider quota calls, 30GB and duration limits, provider-reported byte mismatch, and best-effort orphan cleanup.
6. Verify a completed upload remains unpublished until separate rights review and editorial revision attachment; exercise preview, signed playback, withdrawal and derivative/cache invalidation.
7. Check the behavior when `onAfterResponse` cannot read the private asset header: the current UI correctly fails closed, but this scenario needs live header/CORS coverage to prevent a completed upload that cannot be reconciled from the editor view.

## Next verification — Prediction free feature (separate system)

1. Stage the dedicated Prediction DB role, Hyperdrive, HMAC and migration 0043 only after owner approval. Keep submission readiness false until verified.
2. Exercise actual-browser first-email-on-submit and returning-cookie flow; match kickoff race, same-email/different-device separation, Origin/Sec-Fetch validation, limits, no-store responses and no identifiers in logs.
3. Build verified-email marketing confirmation, withdrawal/unsubscribe and auditable delivery before promotional emails. Pending-confirmation is **not** permission to send marketing.
4. Keep public own-history/leaderboard read models separate from privileged data and preserve legacy campaign and eligibility decisions as OPEN.
5. Do not revive disabled Supabase settlement/VIP/prize routes. The M44 legacy SQL evidence documents conflicting eligibility and monthly audit definitions, which require explicit versioned policy before implementation.

## Architectural constraints

- Public Media on `factsport.com` is the product priority: news, original editorial content, fixtures, scores, match center, broadcast, highlights, CMS, social and AdSense readiness.
- Prediction on `predict.factsport.com` retains separate auth, ledger, rules, campaigns, VIP and prize authorization. Free anonymous submission may be embedded in public Media, but its writes and identities are Prediction-owned.
- Fast ESPN live frontend read path (historically three-second edge polling) is independent of slower scheduled DB synchronization; avoid regressing it when consolidating external Workers.
- ESPN is preferred for matched live scores; football-data.org remains fixture ingestion/unmatched fallback and final-time reconciliation. Do not equate local worker errors with upstream ESPN degradation.
- Keep AdSense disabled until publisher approval, genuine original content, rights review, legal/affiliate review and certified-CMP requirements are satisfied. Do not load ads on interactive prediction/private interfaces.
- Legacy security concerns and disabled main-branch protections remain release blockers. No production reactivation before explicit go/no-go.

## Acceptance before next implementation milestone can be marked complete

- Current branch SHA recorded with isolated, native Worker, disposable PostgreSQL and protected staging results (not inherited from earlier source commits).
- Provider-level tests recorded with reproducible results rather than inferred success.
- No production resources modified; all release-sensitive flags remain fail-closed.
- Remaining parity items are explicit, owner decisions are separated from engineering decisions, and rollback has been validated.

## Next agent first actions

Perform the Media VOD staging provider contract tests first after provisioning approval; fix only evidenced failures, add regression coverage, rerun isolated/native/database/staging gates. In parallel, implement marketing confirmation/unsubscribe as a separate Prediction milestone; do not conflate either with full product cutover.
