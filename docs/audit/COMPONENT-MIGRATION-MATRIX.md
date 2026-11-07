# Factsport v2 shared component migration matrix

**Updated:** 2026-11-06  
**Branch:** `refactor/factsport-v2`

A source scan of the 54 files under `app/components/` identified the following direct Supabase dependencies. Components without direct client imports can still depend on Supabase-backed pages, props, or child components; this matrix tracks only direct imports and table access observed in source.

| Component | Current Supabase dependency | v2 owner | Required work |
|---|---|---|---|
| `AuthProvider.tsx` | Browser Supabase client; `profiles` | Identity/session adapter | Replace with provider-neutral session context backed by validated first-party session; internal UUID and server roles |
| `FanZoneChat.tsx` | Browser Supabase client; `matches` | Community/chat service | Same-origin authenticated API, server-derived identity, moderation, durable message store, rate limits |
| `PredictionBoard.tsx` | Browser Supabase client; `matches`, `campaigns`, `user_predictions` | Prediction/gameplay service | Server-authoritative validation, atomic first-five/lock rules, scoring ledger, replay/concurrency tests |
| `HomeDashboardClient.tsx` | Direct browser Supabase removed; featured match now fetched from same-origin `/api/settings`. API has a PostgreSQL safe-view branch; legacy fallback projects only the needed settings fields. | Public config/read model | Migrate affiliate/public config to typed V2 settings; verify settings cache and no social/provider secret exposure |
| `SignOutButton.tsx` | Browser Supabase auth client | Identity/session adapter | Server session revoke + cookie clear; test refresh-token/session invalidation |
| `ApproveButton.tsx` | Browser Supabase client; `subscriptions`, `profiles` | VIP entitlement/admin command | Remove client writes; server RBAC, step-up, entitlement ledger and audit |
| `AuditManager.tsx` | Browser Supabase client; `monthly_winners`, `profiles` | Prize audit/admin service | Server-only approval, qualification snapshot, deterministic rank/ties, immutable audit |
| `GameRulesManager.tsx` | Browser Supabase client; `site_settings` | Campaign/rules config service | Versioned validated rules, editor/admin RBAC, history and rollback |
| `PromoSettingsManager.tsx` | Browser Supabase client; `site_settings` | Affiliate/promo settings service | Safe field allowlist, server-only write, URL validation and change audit |
| `SocialSettingsManager.tsx` | Browser Supabase client; `site_settings`, `matches` | Social integration settings | Encrypt secrets, server-only adapters, event routing policy, no secret exposure |
| `ProBettingSlipLock.tsx` | Browser Supabase client; `profiles` | VIP/entitlement service | Query server-side entitlements; client display only, no authority |
| `LeagueLeaders.tsx` | Direct browser Supabase removed; calls same-origin `/api/standings/leaders`. API has narrow legacy projection and PostgreSQL `public_competition_player_stats` reader. | Sports stats read model | Apply 0007; add provider ingestion/reconciliation, verify season/player identity, current-season uniqueness and cache/freshness |
| `LiveStandings.tsx` | Supabase public client; `matches` | Live standings domain | Port match read adapter, deterministic table calculation, 3s cache boundary |
| `MiniStandings.tsx` | Opt-in PostgreSQL read path via `public_competition_standings`; Supabase fallback remains when match backend flag is unset. | Standings read model | Apply migration 0006, verify provider ingestion, freshness, season/group sorting and empty states; remove fallback after parity |

## Component-level rules

- No client component writes directly to the database. All writes go through server routes/actions with authenticated user, authorization, CSRF/origin checks, validation, idempotency and audit.
- A user-visible role, VIP badge, match eligibility or prize status is never trusted from React state or a client-submitted profile field.
- Public components receive only explicitly safe DTOs; do not pass entire profiles, settings rows, provider secrets or payment metadata into client props.
- All components use stable v2 IDs and typed domain DTOs; no direct dependency on Supabase response shapes.
- Component tests must cover loading, empty, error, stale data, unauthorized and responsive/mobile states.

See [PAGE-MIGRATION-MATRIX.md](./PAGE-MIGRATION-MATRIX.md) for full page journeys and [ROUTE-MIGRATION-MATRIX.md](./ROUTE-MIGRATION-MATRIX.md) for API/service ownership.


## 2026-11-07 continuation — editorial and homepage component paths

- `HighlightsSlider.tsx`: homepage data can come from rights-reviewed `public_match_highlights`; cards render R2 thumbnails and link to the verified source-video URL when using V2 data. Full `/highlights` page also has a PostgreSQL paginated path.
- `MarkdownRenderer.tsx`: raw article HTML is passed through `rehype-sanitize`; iframe embeds are restricted to HTTPS YouTube, YouTube-nocookie and Vimeo player hosts. Existing `[MATCH_WIDGET:id]` tokens are converted to a custom allowlisted link protocol so the widget still renders without trusting arbitrary HTML IDs.
- `HomeDashboardClient.tsx`: direct browser database access removed for homepage featured-match settings; the component uses a same-origin server API.
- `MiniStandings.tsx`: opt-in PostgreSQL standings reader added. Full `/standings` table and `LeagueLeaders` now have PostgreSQL read paths; `LiveStandings` and tournament/round surfaces remain outstanding.
- These paths require migrations 0004-0006 to be applied in isolated staging before they can be runtime-verified. No migration or production change has been executed.


## 2026-11-07 competition component update

- \`LeagueLeaders.tsx\` no longer creates a browser Supabase client; its goals/assists toggle requests a validated same-origin API.
- \`/standings\` reads the current season/group projection and computes form from season-scoped completed matches. \`/highlights\` has a PostgreSQL paginated listing and verified source links.
- All paths are opt-in until migrations 0004-0007 are applied and provider ingestion supplies current-season standings/scorers/highlights.

## 2026-11-07 match-centre access boundary update — M12

- SecureMatchPlayer.tsx now obtains playback state from GET /api/match/[id]/playback; raw media URLs are no longer supplied as initial client props by /match/[id]. The API withholds URL fields until the server-side 15-minute unlock. Video, audio-only and secondary audio modes are retained.
- ProBettingSlipLock.tsx no longer creates a browser Supabase client and no longer receives pro_analysis from MatchMobileHub. It requests GET /api/match/[id]/analysis; the server performs session and legacy profiles.is_vip checks before exposing analysis.
- MatchHeaderClient and MatchMobileHub receive an explicit public match DTO rather than the full legacy row. Existing child components still rely on legacy match/live/chat/prediction services; no claim of full component parity is made.
- tests/match-media-access.test.cjs covers the client DTO boundary, server unlock response, audio preservation and server-side VIP check. Isolated verification, native build and protected staging passed on commit 45d5cd3b4a5fcd39ab33e1eb58bdf47ba40c5ecd; staging did not invoke these two new endpoints.
- Remaining: V2 entitlement integration, short-lived signed playback grant/proxy, same-origin ticker and child-service migrations, and browser-level authorization/media tests.
