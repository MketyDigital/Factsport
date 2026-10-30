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
