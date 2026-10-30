# SEC-001 — Supabase RLS and authorization audit
Date: 2026-10-30
Scope: user-supplied public.pg_policies SQL result, 48? policy rows; manually verified via code reads. No data/permission mutations.
Status: DB VERIFIED metadata, SOURCE VERIFIED selected related routes, NOT runtime-exploited.

## Critical findings
1. **CRITICAL subscriptions**: permissive policy `Enable all access for authenticated users` applies to all commands with `USING true`, `WITH CHECK true`. It grants *any authenticated subject row-level authorization to all subscription records*, including writes, if SQL table privileges are present. Other owner-only policies cannot restrict this permissive access because permissive policies combine with OR. Verify table grants and revoke/replace urgently. This may affect VIP access integrity.
2. **CRITICAL site_settings**: public SELECT USING true for entire row; current `app/api/social/route.ts` reads `site_settings.social_config` and accesses `social_config.credentials` for external-provider tokens. Public RLS policy potentially exposes values in `social_config` via Supabase PostgREST if anon/auth table SELECT privileges exist. **Do not run `SELECT social_config` or paste secrets into chat/public git.** Immediately verify exposure via grant introspection and rotate any potentially exposed secrets. App `app/api/settings/route.ts` itself selects * on the server but explicitly only emits affiliate links/codes; the wider DB/PostgREST surface is the concern, not automatic JSON leak from this particular route.
3. **HIGH user_predictions**: permissive public SELECT true enables access to all user prediction rows if role grants allow, raising privacy/game integrity concerns. INSERT checks only `auth.uid() = user_id` at RLS layer; trigger secures some fields but cannot verify all game rules. UPDATE self policy has no explicit WITH CHECK (PostgreSQL may use USING expression for check), trigger allows some other columns to change, need column privileges+RLS detailed tests. Protect prediction secrecy before kickoff.
4. **HIGH predictions legacy table**: permissive INSERT policy `User create prediction` / `Users can create predictions` with only owner check logically weakens separate `Strict Insert predictions` policy that also checks match kickoff. This weakness matters if table grants allow INSERT. If no app writes to table, still reduce attack surface.
5. **HIGH profiles**: public SELECT true on entire table, plus self UPDATE. Trigger `protect_profile_stats` protects only subset of stats for `authenticated`, potentially leaving eligibility counters/other sensitive columns writable if grants allow. No claim of live exploitation until grants verified.
6. **HIGH admin privilege derivation**: `global_studio` UPDATE allows `auth.jwt()->'user_metadata'->>'is_admin'='true'`, potentially user-editable in Supabase Auth. Admin policy also uses email allowlists in several tables, with divergent email sets. New system must use server-controlled roles/claims; no user-editable auth metadata. Inspect `is_admin()` function and auth routes.
7. **MEDIUM redundant policies**: matches has 5+ overlapping public SELECT rules; news three; profiles three; subscription/prediction repeated. Consolidate to precise, audited single-role intentions. Supabase RLS being enabled does NOT imply least-privilege behavior.
8. **MEDIUM default public reads**: campaigns, campaign_leaderboards, monthly_winners, global_studio etc. Audit columns before copying policy; some media data public, secrets and settings not.

## Context and technical caveat
RLS policies are row permissions, not sufficient alone to prove user can access/modify records. PostgreSQL GRANT privileges, schema exposure in PostgREST, service-role bypass and deployed auth are also required. Findings above are policy-level risks; inspect grants and API exposure to confirm end-to-end exploitability. Do not test with write queries or production credentials.

## Verified code linkage
- `app/api/social/route.ts`: reads `site_settings.social_config`, credentials for posting integration, with service-role client.
- `app/api/settings/route.ts`: server `select('*')` from site_settings; response is selected affiliate values only, no direct passthrough of social_config.
- `app/api/admin/settings/route.ts`: service-role write of affiliate settings after admin email-based session check; consolidate roles.
- `app/admin/layout.tsx`, `middleware.ts`: email allowlist checks; `middleware.ts` also contains a hardcoded Basic Auth password comparison. Never store real credentials in source. Rotate or remove it in security modernization; do not copy password into this audit.
- SQL trigger functions previously supplied: `protect_profile_stats`, `secure_predictions`.

## Immediate containment recommendations (require user's explicit DB administration)
- Do not share `site_settings.social_config` values, access tokens, auth tables, PII, private predictions or sensitive config in audit exports.
- Rotate previously surfaced webhook bearer credential, and verify/rotate any social API tokens that might have been exposed by public settings SELECT.
- Verify grants and selected schema exposure, and prioritize correcting `subscriptions` ALL, site_settings public read, global_studio user_metadata is_admin, public prediction reads.
- Changes to the paused production Supabase project must be separately reviewed; no RLS mutating SQL has been run by audit agent.

## Next read-only SQL: table privileges (public schema)
```sql
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name IN ('subscriptions','site_settings','profiles','user_predictions','predictions','global_studio')
  AND grantee IN ('anon','authenticated','PUBLIC')
ORDER BY table_name, grantee, privilege_type;
```
`information_schema.role_table_grants` may omit some inherited effective permissions; follow up with `has_table_privilege('anon', 'public.site_settings', 'SELECT')` as appropriate.

## Next read-only SQL: column names of sensitive tables (no values)
```sql
SELECT table_name, ordinal_position, column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('subscriptions','site_settings','profiles','user_predictions','predictions','global_studio')
ORDER BY table_name, ordinal_position;
```

## Target authorization rules
- Public visitors: allowlisted match/news/standings fields, publicly published articles only.
- Players: own profile private fields, own predictions and subscriptions only; server decides and writes scoring/eligibility.
- Editors: content drafts/publishing under server-managed RBAC.
- Admins: restricted scoped service access and audited operations; no hardcoded-email-only checks or user-controlled metadata elevation.
- Workers: least-privilege database users; auth service claims validated server-side.
- Provider credentials: Cloudflare secret bindings, NEVER public site_settings or env NEXT_PUBLIC_*.
- Payment/entitlement changes: privileged server commands only.
- Tests must prove anonymous and regular user cannot modify/read private VIP/payment info or other players' selections.

## SQL 09 — Effective table privilege results (2026-10-30)
User executed `has_table_privilege` on eight tables, crossed with anon/authenticated and SELECT/INSERT/UPDATE/DELETE. **All 64 effective privilege checks returned true** (8 tables × 2 roles × 4 operations): `global_studio`, `matches`, `news`, `predictions`, `profiles`, `site_settings`, `subscriptions`, `user_predictions`.

**Confirmed effective table-level privileges, not effective row-level access.** An RLS policy must still permit an operation and the role must access the API schema. The results strengthen the following policy-level findings:
- `site_settings`: public SELECT true plus anon/authenticated SELECT privilege means the table's rows are accessible under RLS to either role through a suitably exposed API. Its `social_config` includes credential material used by `app/api/social/route.ts`. **Potential critical exposure of credentials, contingent on endpoint/schema access and column-specific grants.** Do not output credential contents; verify column privileges and rotate tokens.
- `subscriptions`: authenticated ALL policy true + authenticated DML privileges means **any authenticated session is authorized at both table and RLS layers to read/write any subscription row**, unless another separate control prevents API access. Treat as CRITICAL entitlement-integrity risk.
- `user_predictions`: public SELECT true and anon/auth SELECT privilege means match prediction rows could be readable by anonymous/public clients if API exposure is enabled; potential advance prediction disclosure.
- `predictions`: public owner-check INSERT policies with anon/auth INSERT privilege undermine stricter kickoff check for authenticated users. `auth.uid()` condition still applies; this is not anonymous arbitrary insert permission.
- `profiles`: public SELECT true plus both roles' SELECT privileges means unrestricted row-level visibility to all profile columns that are granted (column-level privilege rules also need inspection). For authenticated UPDATE, ownership via RLS and trigger field protection still apply.
- `global_studio`: authenticated UPDATE privileges plus policy allowing `user_metadata.is_admin` true warrants urgent verification of user-editable claims and any editability restrictions.
- `matches` and `news`: broad table-level DML grants DO NOT mean anonymous writes; relevant RLS admin checks still apply.

### Priority and containment
P0: Restrict service credentials stored in public-readable site_settings; confirm whether `social_config` column is directly readable via exposed Supabase API without requesting or printing its values. Plan secret rotation.
P0: Block non-admin modification of subscriptions with restrictive RLS / server-only service mutation (after reviewing app dependencies and authorizing a safe patch).
P1: Review public prediction read and legacy `predictions` submit enforcement.
P1: Consolidate auth and admin RBAC, audit public profiles, and enforce column-level response projection.
**No write/privilege modification executed.** User's SQL 10 pasted SQL text but no returned column rows, so column inventory remains open.

### Safe next read-only query: column privilege summary (no values)
```sql
SELECT
  c.table_name, c.column_name,
  has_column_privilege('anon', format('public.%I', c.table_name), c.column_name, 'SELECT') AS anon_can_select,
  has_column_privilege('authenticated', format('public.%I', c.table_name), c.column_name, 'SELECT') AS authenticated_can_select
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('site_settings', 'subscriptions', 'profiles', 'user_predictions')
ORDER BY c.table_name, c.ordinal_position;
```
This is metadata only. Do not query or paste the actual values of `social_config`, `credentials`, passwords, tokens or auth records.

### SQL 10 still outstanding
The user's message included the SQL 10 query itself without the resulting column listing. Ask for returned columns after running it, not for a re-run of privilege checks.

## SQL 10 — Sensitive column inventory VERIFIED (2026-10-30)
User supplied exact metadata for six tables:
- `global_studio` (5): id, title, audio_url, video_url, is_active.
- `predictions` (8): id, user_id, match_id, home_guess, away_guess, status, user_ip, created_at. **Contains IP address data**; do not expose to public.
- `profiles` (16): id, email, full_name, phone, is_vip, vip_expiry, points, prediction_count, role, created_at, vip_expires_at, monthly_points, monthly_correct_scores, is_verified, eligible_monthly_points, eligible_monthly_correct_scores. **Email and phone are personal information; privilege/visibility must be restricted**. Two VIP expiry columns exist: `vip_expiry` and `vip_expires_at`; inspect live reads and migration semantics before consolidating.
- `site_settings` (18): includes affiliate data, gateway_link, crypto_network, crypto_address, telegram_support, daily_limit, target_exact_scores, min_points_floor, youtube_link, announcement fields, and **social_config jsonb**. Treat credentials embedded in social_config as secrets; never copy actual data into public docs.
- `subscriptions` (9): id, user_id, plan, amount, payment_method, transaction_ref, proof_url, status, created_at. **Contains financial and payment evidence metadata**; authenticated ALL true RLS is CRITICAL.
- `user_predictions` (14): match_id, user_id, outcome and exact-score guesses, points, status, timestamps, is_eligible_for_prize, campaign_id, custom_predictions, campaign_points_awarded. Privileged calculation fields must be server-write only.

SQL 10 shows **column existence/types, not effective column SELECT permissions**; SQL 11 remains outstanding.

### Code linkage from source review (2026-10-30)
- `app/vip/upgrade/page.tsx`: browser client `site_settings.select('*')` for payment/config rendering; reads current user's VIP and pending subscription; writes new `subscriptions` request. This is a critical use path for separating public presentation configuration from private credentials and for moving subscription mutations into reviewed, authenticated server actions. Data may already be reachable through direct Supabase API even if UI is selective.
- `app/dashboard/page.tsx`: server gets user's profile with `select('*')`, reads `site_settings` rule thresholds and user's prediction history; target must return minimal user-only shape.
- `app/leaderboard/page.tsx`: public-facing profile fields deliberately selected for leaderboard; use separate public profile projection to avoid exposing email and phone.
- `app/admin/users/page.tsx`: service-role profile `select('*')` after app-layer admin gate.
- `app/api/admin/users/route.ts`: app-layer privileged update to `profiles.is_vip` via service-role client; maintain audit trail and strong server-side authorization.
- `app/dashboard/settings/page.tsx`: self-edit `profiles.full_name`; normal user's editable fields should be strictly allowlisted.

### Recommended target data boundary (not yet implemented)
Public media/leaderboard views: only display name, public ranking and appropriately delayed or anonymized predictions. 
Private account storage: email, phone, verification, VIP entitlements and payment references unavailable to anonymous access or other players.
Server-only integration settings: gateway credentials, webhook URLs/tokens, social_config credentials, internal administration config. Separately publish safe announcement and rules configuration.
Subscription lifecycle: request/receipt/approval/payment verification on server only, with explicit state transitions and durable audit.
Separate gameplay tracking from personal profile data; never let user update score, eligibility, VIP status or verified flag directly.
Target DB still starts with zero game data, but user/entitlement migration remains a separate reviewed decision.
