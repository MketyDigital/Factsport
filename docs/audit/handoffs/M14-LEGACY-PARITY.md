# M14 — Legacy behaviour and workflow parity audit

**Date:** 2026-11-07  
**Repository:** MketyDigital/Factsport  
**Branch:** refactor/factsport-v2  
**Purpose:** Record legacy behaviours verified directly in source so V2 migration does not silently omit product functionality.  
**Status:** SOURCE AUDIT IN PROGRESS. This is a parity inventory, not a claim that the V2 replacement is complete.

## Audit rule

A route is not considered migrated because it renders or because its main database read works. Every behaviour, state transition, write, authorization rule, provider integration, cache/polling contract, and failure/empty state must have an explicit V2 owner and a test. Client-side visibility, localStorage flags, and UI timers are not server-side authorization.

## Match-centre composition and live data

Source files inspected on the legacy/default branch:
- `app/match/[id]/page.tsx`
- `app/components/MatchMobileHub.tsx`
- `app/providers/MatchLiveProvider.tsx`
- `app/components/GoalRushTicker.tsx`
- `app/components/FanZoneChat.tsx`
- `app/components/MOTMVoteWidget.tsx`
- `app/api/stream/token/route.ts`

Verified behaviours to preserve:
- ESPN-linked live match refresh via the shared `fetchLiveMatchDeduplicated` utility and `MatchLiveProvider`; finished matches stop polling.
- Match page loads team form and external match data, and exposes H2H, score, lineups, stats, predictor/win probability, match events and match-linked standings.
- Match page's Goal Rush ticker excludes the current match, includes live matches and today's fixtures, prioritizes live matches, caps the source list at 15, and polls live ticker entries every 30 seconds through the deduplicator.
- Goal Rush ticker displays a live clock, scores, scheduled kickoff time and FT state; it links to the match centre.
- MatchMobileHub exposes Live Chat, Stats & XI, Table and Pro Slip tabs, plus a Predict jump link; table/pro/predict tabs are hidden after a finished state or four hours after scheduled kickoff.
- Match page has a 15-minute pre-kickoff player unlock window, separate live/finished media selection, optional audio, widget-specific rendering, and JSON-LD/social video metadata.
- Match detail page also reads site announcement text/link/enabled state and a ticker match projection including `displayClock`.

V2 parity gates:
- Match clock and provider freshness must be modelled separately from generic match status; stale/missing provider data must not be presented as fresh live state.
- Preserve ESPN identity mapping and shared edge-cached/deduplicated live reads. Do not fan out per-viewer database polling.
- Preserve match widget identity and its alternate rendering path.
- Preserve H2H, form, stats, lineups, events, predictor probability, table context, match navigation and status transitions.
- Validate correct schema.org event states for scheduled/live/finished/cancelled/postponed matches; current legacy implementation should not be copied blindly.
- Exercise social metadata and video-player sharing paths without exposing private source URLs in locked states.

## PredictionBoard and campaign rules

Source inspected: `app/components/PredictionBoard.tsx`.

Verified legacy behaviours:
- The board disappears once kickoff has passed and avoids prediction/campaign reads after the client-side lock.
- Existing prediction is loaded per match and user; unique prediction conflicts are surfaced as already locked.
- Main prediction requires a winner selection (home/draw/away).
- Exact score is normally required, but an active campaign can make it optional.
- Main prediction records outcome, home/away score, pending status and prize eligibility state.
- Campaign selection may come from a match's `campaign_id` or an active campaign targeting the league.
- Campaign rules control points for outcome, exact score, first scorer, red card and penalty, plus whether exact score is required. Non-campaign defaults are also present.
- Bonus markets include first scorer, red card and penalty; bonus selections update the existing prediction's custom prediction payload.
- First-scorer player options are derived from the match lineups and include team identity in the display label.
- A signed-in user is required to submit the legacy main prediction; unauthenticated users are redirected to login.

V2 parity gates:
- Campaign assignment, active window, league targeting, rule snapshot/version, points, score optionality, bonus market eligibility, roster validity and kickoff locking must be evaluated server-side.
- Use a transaction/unique constraint for one main prediction per user/match and idempotent bonus updates; never trust browser status, timestamps or submitted points.
- Preserve historical campaign rules for already-submitted predictions; changing a campaign later must not rewrite old scoring semantics.
- Add tests for simultaneous submissions, late requests, delayed/postponed fixtures, missing lineups, campaign deactivation, duplicate bonus writes, and settlement/recalculation.
- Do not migrate the legacy prediction UI until campaign administration, settlement, leaderboard and prize eligibility are covered end-to-end.

## FanZoneChat and match pins

Source inspected: `app/components/FanZoneChat.tsx`.

Verified legacy behaviours:
- Chat messages are served by the separate `https://chat-api.factsport.com` Worker.
- Polling pauses when the browser tab is hidden and stops after finished/4-hour expiry logic.
- Live chat polls every 3 seconds; scheduled chat polls every 60 seconds.
- Match pin data is read from same-origin `/api/match/pin`; pin refresh is every 15 seconds live and every 60 seconds scheduled.
- Chat combines official match events with fan messages, orders the combined feed, and retains the latest 150 entries.
- Supports replies with quoted context, optimistic message rendering, admin announcements, pinned text and optional link, and a scroll-to-bottom affordance.
- Non-admin UI blocks URLs and applies a 3-second client-side send cooldown; admins can send links and announcement messages.
- Pin write/clear currently updates match pin columns directly through the browser Supabase client.

V2 parity gates:
- Move message identity, rate limits, URL policy, moderation, anti-spam, pin authorization and announcement authorization to the server/Worker. Client cooldown and role checks are only UX.
- Preserve three-second live freshness, slower scheduled polling, hidden-tab pause, official-event interleaving, reply display, pinned content and admin announcement semantics.
- Preserve moderation/report/block/abuse controls and retention once fully audited; do not replace the chat Worker with a naive table read.
- Ensure failed sends remove/reconcile optimistic messages rather than leaving phantom chat entries.
- Admin pins must use server-side RBAC/step-up and audit records; validate outbound links and prevent unsafe schemes.

## MOTM voting

Source inspected: `app/components/MOTMVoteWidget.tsx`.

Verified legacy behaviours:
- Candidate list comes from starting XI lineups for both teams.
- Votes and submission use `https://live-api.factsport.com/api/motm`.
- Client uses localStorage key `motm_voted_<matchId>` as a display marker.
- UI closes voting after 24 hours from scheduled kickoff and shows the top two vote shares.
- Worker receives current match status on reads to support status-aware caching.

V2 parity gates:
- Server must enforce one vote per eligible voter/match, candidate membership, voting window, match identity and duplicate/race handling. localStorage is never authoritative.
- Define whether vote identity is anonymous, account-based, cookie-based or a combination; preserve privacy and prevent trivial repeat voting.
- Test missing/late lineups, duplicate player names, postponed/rescheduled matches, vote-window boundary, cache invalidation and zero-vote state.
- Preserve results aggregation and top-two display without exposing voter identities.

## StreamIO and media provider flows

Source inspected: `app/api/stream/token/route.ts`; media player and room components also require complete provider-by-provider audit.

Verified token route behaviours:
- GET supports anonymous listeners, authenticated users and stateless match-scoped guest invite tokens.
- Guest JWT is checked for match identity and expiry; guest user identity is generated for the Stream session.
- Authenticated users receive profile username/avatar; admin role is currently derived from profile role, user metadata or a hardcoded email allowlist.
- Stream user tokens are minted for four hours.
- POST requires a logged-in admin and generates a match-scoped guest invite valid for 24 hours.
- Special global studio identifier `global-goal-rush` generates a `/live?guest=...` URL; other IDs generate `/match/<id>?guest=...`.

V2 parity gates:
- Preserve anonymous, signed-in and invited-guest room entry, match binding, expiry, user profile metadata and global studio invite semantics.
- Replace hardcoded admin email allowlists and client/user-metadata admin claims with server-managed RBAC and audited step-up.
- Validate match/studio identifiers, guest-token revocation needs, replay policy, key rotation and token audience/issuer; avoid exposing Stream secrets.
- Audit StreamIO versus raw HLS/audio, YouTube, Vimeo and generic iframe providers independently. A generic media URL unlock must not break provider-specific embed or room behaviour.
- Keep stream-token issuance independent from raw playback grants; they are different authorization contracts.

## Public settings, promotions and monetization

Source inspected: legacy `app/api/settings/route.ts`, match detail page and home page.

Verified legacy settings endpoint:
- Reads `site_settings` fields for 1xBet and Melbet links/codes.
- If the 1xBet booking code is empty, falls back to the newest match with a non-empty booking code.
- Returns `link1x`, `linkMel`, `code1x`, `codeMel`.
- Match detail reads announcement text, announcement link and enabled flag.
- Match/home surfaces include advertising and promotional components; these are part of the current product behaviour and cannot be silently removed by a narrow settings projection.

V2 parity gates:
- Inventory every setting field, consumer, visibility class, cache lifetime, fallback and admin writer before replacing `site_settings`.
- Preserve approved commercial placements and campaign/booking-code behaviour only within the product/legal surface approved by the owner. Public/private separation is a product decision, not a migration side effect.
- Public projections must be explicit allowlists; private credentials, admin settings, payment data and internal campaign rules must never leak.
- Add cache invalidation tests for settings changes and booking-code fallback; preserve safe empty states.

## Security and legacy defects to correct, not reproduce

The legacy code contains client-side-only controls and trust decisions:
- Prediction kickoff visibility/lock is computed in the browser; API/database must independently reject late writes.
- FanZoneChat URL restrictions, cooldown and announcement toggles are client checks; Worker must enforce them.
- MOTM localStorage is a client-side voted marker; Worker must enforce uniqueness.
- Stream token route accepts user metadata admin claims and a hardcoded email allowlist; V2 must use managed roles.
- Match player URL sanitization shown in page source only rejects a `javascript:` prefix and is not a sufficient provider/SSRF policy.

These findings do not prove exploitability in every connected backend; they identify controls that must not be treated as authoritative during migration.

## Still to inspect — do not mark legacy parity complete

- Full FactSportPlayer provider matrix: raw HLS/DASH/MP4, audio-only, YouTube/Vimeo, generic iframe, StreamIO room, embed/share, lock/unlock and failure fallbacks.
- Full FactSportMediaRoom UI and guest invite consumption, host/moderator roles, room lifecycle and reconnect behaviour.
- Remaining match-centre components: StatsLineupsTabs, HeadToHeadStats, WinProbability, ScoreAxisWidget, ProBettingSlipLock, LiveStandings, MatchHeaderClient and mobile/desktop differences.
- Full public homepage shell: affiliate banners, AdSense/Adsterra surfaces, install/PWA prompts, navigation, ads consent, analytics and search/SEO.
- All account journeys: register, verify, login, OAuth/session refresh, logout, forgot/reset password, profile changes and dashboard.
- VIP upgrade/payment proof, verification, entitlement expiry/revocation, subscriptions and renewal.
- Admin workflows: match/provider correction, campaign authoring, editorial workflow, studio controls, user support, role changes, audit logs and emergency controls.
- Background ingestion/scheduling: ESPN fetch arbitration, fixtures/results reconciliation, standings/scorers, settlement, leaderboard rollover, campaign lifecycle, notifications and retries.
- Privacy/retention/export/deletion, consent, cookies, bot protection, rate limiting and incident response.
- Route-level parity for live hub, embed, tournament pages, leaderboard, help/legal pages and mobile/PWA install/offline behaviour.

## Cutover policy

No V2 feature flag may be enabled for a surface until its full parity checklist, API authorization, data migration/reconciliation, operational monitoring, failure tests and browser/staging E2E are complete. Keep legacy fallback available until evidence supports removal. This audit itself does not authorize production changes, migrations or DNS/Worker route changes.
