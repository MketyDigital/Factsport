# Factsport v2 shared component migration matrix

**Updated:** 2026-11-06  
**Branch:** `refactor/factsport-v2`

A source scan of the 54 files under `app/components/` identified the following direct Supabase dependencies. Components without direct client imports can still depend on Supabase-backed pages, props, or child components; this matrix tracks only direct imports and table access observed in source.

| Component | Current Supabase dependency | v2 owner | Required work |
|---|---|---|---|
| `AuthProvider.tsx` | Browser Supabase client; `profiles` | Identity/session adapter | Replace with provider-neutral session context backed by validated first-party session; internal UUID and server roles |
| `FanZoneChat.tsx` | Browser Supabase client; `matches` | Community/chat service | Same-origin authenticated API, server-derived identity, moderation, durable message store, rate limits |
| `PredictionBoard.tsx` | Browser Supabase client; `matches`, `campaigns`, `user_predictions` | Prediction/gameplay service | Server-authoritative validation, atomic first-five/lock rules, scoring ledger, replay/concurrency tests |
| `HomeDashboardClient.tsx` | Browser Supabase client; `site_settings` | Public config/read model | Explicit safe config projection, cache and validation; no secret settings exposed |
| `SignOutButton.tsx` | Browser Supabase auth client | Identity/session adapter | Server session revoke + cookie clear; test refresh-token/session invalidation |
| `ApproveButton.tsx` | Browser Supabase client; `subscriptions`, `profiles` | VIP entitlement/admin command | Remove client writes; server RBAC, step-up, entitlement ledger and audit |
| `AuditManager.tsx` | Browser Supabase client; `monthly_winners`, `profiles` | Prize audit/admin service | Server-only approval, qualification snapshot, deterministic rank/ties, immutable audit |
| `GameRulesManager.tsx` | Browser Supabase client; `site_settings` | Campaign/rules config service | Versioned validated rules, editor/admin RBAC, history and rollback |
| `PromoSettingsManager.tsx` | Browser Supabase client; `site_settings` | Affiliate/promo settings service | Safe field allowlist, server-only write, URL validation and change audit |
| `SocialSettingsManager.tsx` | Browser Supabase client; `site_settings`, `matches` | Social integration settings | Encrypt secrets, server-only adapters, event routing policy, no secret exposure |
| `ProBettingSlipLock.tsx` | Browser Supabase client; `profiles` | VIP/entitlement service | Query server-side entitlements; client display only, no authority |
| `LeagueLeaders.tsx` | Supabase public client; `tournament_scorers` | Sports stats read model | Port scorers schema/provider source, stable season/competition identity, cache |
| `LiveStandings.tsx` | Supabase public client; `matches` | Live standings domain | Port match read adapter, deterministic table calculation, 3s cache boundary |
| `MiniStandings.tsx` | Supabase public client; `standings` | Standings read model | Port season/group-aware standings and freshness metadata |

## Component-level rules

- No client component writes directly to the database. All writes go through server routes/actions with authenticated user, authorization, CSRF/origin checks, validation, idempotency and audit.
- A user-visible role, VIP badge, match eligibility or prize status is never trusted from React state or a client-submitted profile field.
- Public components receive only explicitly safe DTOs; do not pass entire profiles, settings rows, provider secrets or payment metadata into client props.
- All components use stable v2 IDs and typed domain DTOs; no direct dependency on Supabase response shapes.
- Component tests must cover loading, empty, error, stale data, unauthorized and responsive/mobile states.

See [PAGE-MIGRATION-MATRIX.md](./PAGE-MIGRATION-MATRIX.md) for full page journeys and [ROUTE-MIGRATION-MATRIX.md](./ROUTE-MIGRATION-MATRIX.md) for API/service ownership.
