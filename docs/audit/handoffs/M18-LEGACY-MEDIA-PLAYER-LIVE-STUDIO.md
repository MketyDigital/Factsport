# M18 — Legacy Media Player, Live Studio and Streaming Identity Audit

Date: 2026-11-07
Source: legacy `main`
Target: `refactor/factsport-v2`
Status: source audit and ownership classification; no production changes.

## 1. Ownership decision

All functionality in this handoff belongs to the **Media system (Factsport.com)** or shared Platform Operations:

- Match video/audio playback and player UI: Media.
- Public live coverage discovery and live page: Media.
- Global Goal Rush studio and public live audio/video: Media.
- StreamIO room identity, anonymous listening, authenticated call-in and invited guest access: Media live-broadcast capability, with identity/token issuance supported by Platform Operations.
- Provider ingestion and live score refresh: Media/Platform Operations.
- Admin publishing of public studio media: Media editorial/broadcast permission.

None of these are Prediction-system features. VIP payment, prediction premium entitlements, campaign management, settlement and leaderboard privileges must not be used as a substitute for StreamIO room roles. The legacy term “VIP Guest” is a broadcast guest label, not proof of paid prediction VIP status.

## 2. Legacy playback matrix

### Match player (`FactSportPlayer.tsx`)

Verified supported paths:
- YouTube links (`youtube.com`, `youtu.be`, embed URLs) normalized to YouTube iframe embeds.
- Direct raw video/audio extensions: MP4, WebM, OGG, MP3, M3U8 and WAV; audio/video elements selected by mode/extension.
- Generic iframe/embed fallback for other media URLs.
- StreamIO sentinel `streamio` routes into `FactSportMediaRoom`.
- Match player supports video/audio mode, finished-match playback, embed mode, fullscreen, mute/play controls, progress/buffering state and global player registration/tune-in.
- Client presentation has a 15-minute pre-kickoff unlock timer. This is not an authorization boundary; V2's server-side playback gate must remain authoritative.
- YouTube and generic iframe handling must be provider-specific. Do not pass arbitrary unvalidated URLs into an iframe or raw media element.

### Live coverage page (`/live`, `LiveMediaClient.tsx`)

- Public Live Center combines video/audio coverage with live score and tournament navigation.
- Coverage cards include matches that are live or scheduled for the visitor's local calendar day, distinguishing matches with audio/video coverage from uncovered live/today matches.
- Shows a next upcoming match message when there is no live coverage.
- Supports a global studio panel when studio is active and a media URL is configured.
- Legacy page also includes a studio chat/FanZone surface and ad placement; these need separate consent/ad and chat policy reviews.
- Preserve timezone-correct local-day grouping; do not replace with UTC-day assumptions.

### Global Goal Rush studio

- Studio settings include title, audio URL, video URL and active switch.
- The `streamio` sentinel selects StreamIO audio studio; video URL takes precedence in global media selection.
- Global room identity is `global-goal-rush`; guest invitation links route to `/live?guest=...`.
- Studio includes public listeners, live participants, admin host controls, guest invitations, hand-raise/call-in, participant audio permissions and moderator controls.
- `updateStudioSettings` in legacy uses service-role credentials without explicit local caller authorization. Do not port this action as-is. V2 must require a Media broadcast-management permission and validate provider URL/room configuration.

## 3. StreamIO token and invitation contract

Legacy `app/api/stream/token/route.ts`:

### GET room token
- Accepts `match_id`; optional guest JWT.
- Guest JWT is verified using Stream secret and bound to the requested `match_id`.
- Guest identity is generated per request (`guest-...`), with display label “VIP Guest”.
- Authenticated users resolve profile role/name/avatar; legacy admin classification accepts a hardcoded email allowlist, profile role admin, **or** user metadata `is_admin=true`.
- Unauthenticated visitors receive an anonymous listener identity.
- Stream user token lifetime is 4 hours.
- Stream API key is public client configuration; Stream secret remains server-only.

### POST guest invitation
- Requires logged-in user and legacy admin classification.
- Generates stateless guest JWT with match_id/is_guest and 24-hour expiry.
- Produces a match-bound URL, or global studio URL for `global-goal-rush`.
- No explicit durable invite record, revocation list, one-use enforcement or audit record was found in this route.

### V2 requirements
- Separate room roles from prediction VIP/paid entitlements.
- Replace hardcoded admin emails and user_metadata admin claims with explicit Media broadcast permissions.
- Guest invites must be room-bound, expiring, revocable and auditable; define whether reusable/multi-use is intended.
- Preserve anonymous listener access where the broadcast is public, while rate-limiting token issuance and preventing identity collisions/abuse.
- Authenticated call-in permission must be granted/revoked by server-authorized host/moderator controls; never trust a client-supplied role.
- Keep Stream secret server-only; issue short-lived room credentials after authorization and validate room/match scope.
- Decide whether guest invitation should remain 24 hours and Stream token 4 hours or be shortened; do not silently alter broadcaster workflow.
- Preserve global studio room and match-specific rooms as distinct room scopes.
- Provide moderator audit events for invite generation, participant admission, mic grant/revoke and room shutdown.

## 4. Live provider refresh

Legacy `app/api/live/route.ts`:
- Uses ESPN live scoreboard/details for matches in a window from 24 hours before to 2 hours after current time.
- Includes live/upcoming matches, recently finished matches and finished matches with missing events for repair.
- Updates status, score, display clock, events, stats, lineups, venue/stage/group/referees/predictor.
- Preserves Football-Data-tracked terminal scores rather than blindly overwriting them with ESPN.
- Uses an in-memory `Map` to suppress duplicate social event triggers if DB update fails; this is process-local and not durable across Worker isolates/restarts.
- Posts social changes directly and also writes match updates, while other database webhook triggers can post social events. Deduplication/outbox behavior is not guaranteed by this in-memory cache.
- Uses a CRON_KEY query parameter and service-role Supabase client in legacy.

V2 owner: Media/Platform Operations, not Prediction. Preserve provider precedence, terminal-result repair, event/stat/lineup refresh and public freshness. Replace process-local dedupe with durable event/outbox idempotency, keep cron credentials out of URLs, and separate ingestion writer permissions from public readers.

## 5. Security and parity defects to fix

1. Client-side 15-minute playback unlock is not security; keep server-side authorization and short-lived delivery grants.
2. Generic iframe and raw media URLs need strict provider allowlists, scheme/host checks, redirect/DNS protections where applicable, content-type restrictions and CSP/sandbox policy.
3. Legacy Stream admin classification trusts hardcoded email list and mutable user_metadata `is_admin`; replace with server-side permission grants.
4. Guest token is room-bound and expiring, but has no recorded revocation/one-use state; define and test the new lifecycle.
5. Per-request anonymous/guest IDs are random and not durable; use a controlled anonymous session identity strategy with collision resistance and abuse controls.
6. Studio server action has no explicit local authz check; enforce it before service-role writes.
7. In-memory live-update dedupe is not durable and does not guarantee exactly-once social publication; use a transactional outbox/dedup key.
8. Preserve anonymous listening and logged-in call-in as distinct capabilities. Do not require prediction account/VIP just to listen to public broadcasts.
9. Do not confuse “VIP Studio Guest” with a paid prediction VIP member or entitlement.
10. Keep the public media page free of private room tokens, Stream secrets, prediction account data and payment state.

## 6. V2 parity acceptance

- Provider contract tests for YouTube, raw HLS/MP4/audio, approved generic embed and StreamIO.
- Browser tests for 15-minute server lock, unlock, finished-match playback, invalid provider URL, iframe CSP/sandbox and mobile audio behavior.
- Tests for anonymous listener, authenticated fan, authorized host/moderator, guest invite, expired invite, wrong-room invite, revoked invite, mic grant/revoke and token expiry.
- Tests proving media broadcast roles do not depend on prediction VIP/payment status.
- Live page tests for local-day grouping, coverage/uncovered cards, next-up state, global studio and chat/ad consent boundaries.
- Ingestion tests for provider precedence, recently finished repair, durable social outbox idempotency, retries and worker restart.
- Keep media playback/studio flags disabled until protected staging browser tests pass.

No production token, room, broadcast setting, database row, route, secret or deployment was changed by this audit.
