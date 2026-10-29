# DB-002 — Clean operational reset, full system preservation
Date: 2026-10-30
Status: APPROVED USER DIRECTION; implementation NOT started

## Exact migration rule
**Fresh data; full product.** Deploy the upgraded existing Factsport software and recreate its complete database schema, rules, integrations, jobs and capabilities on Mkety Core PostgreSQL / justified Cloudflare services, while starting transactional and generated data from zero. Do NOT bulk-import legacy matches, scores, match events, predictions, points, leaderboards or other accumulated gameplay history. No production writes until explicit deployment authorization.

## Must preserve and recreate
- All source code and verified user-facing behavior, including dual ESPN/football-data.org match sources; sports data normalization, matching, fallback, scheduling, standings, news publishing, highlights, match center, editorial tools, automation, social webhooks, user accounts/auth architecture, games, prediction settlement, campaigns, VIP capabilities, and admin tools.
- Public schema definitions: tables, types, defaults, relations, constraints, indexes, views, functions, triggers, policies and access boundaries, as reimplemented securely in target PostgreSQL.
- Configuration/business rules (with a reviewed new default configuration), league maps, provider mappings, templates, content models and cron definitions. Credential **names** and integration configuration model are preserved, but keys themselves must be rotated/recreated as deployment secrets.
- Deterministic tests and provider payload fixtures, sanitized and license-compliant.
- Explicit permission models independent of Supabase auth.role() and RLS implicit service-role semantics.

## Default reset/disposition by class
- **RESET:** matches, match events, live states, sync cursors/caches, scores, standings, tournament scorer stats, auto-generated highlights references, predictions, game history, player/monthly/campaign points, rankings, monthly winners, cron/automation logs, transient social posting records.
- **RECREATE EMPTY:** all tables even if empty in legacy project; eligibility/settlement state and audit record structures.
- **RESEED REVIEWED CONFIG:** site settings, supported leagues, default roles, campaign templates, editorial categories, required system accounts, curated team mappings/logos and provider integrations, where useful and lawful.
- **SEPARATE DECISION REQUIRED:** user identities/profiles/password migration, paid VIP entitlements or financial obligations, editorial news articles and authored media, legal/compliance records, historical prize winners or outstanding claims. Resetting score history does not extinguish contractual or user rights. Editorial content is core media value and must not be discarded accidentally.
- **NEVER COPY:** secrets, passwords, service-role keys, access tokens, production private personal information into public GitHub or chat.
- **NOT a data migration:** starting from zero is not permission to destroy the existing database; retain source snapshot/backup and rollback access until validation and signoff.

## Important bootstrapping
- Recreated empty matches means the ingest engine MUST repopulate fixtures on a controlled bootstrap run; establish rate limits, match deduping and source precedence.
- New user predictions = 0; new leaderboard totals = 0. Exactly-once settlement and eligibility need corrected transactional implementation before new scoring begins.
- Empty log tables must accept first scheduled jobs; avoid accidental post-deployment mass social notifications for freshly imported fixtures.
- News/editorial handling needs user signoff separately: preserve published articles or relaunch with original editorial content.

## SQL protection-function findings (source: user-supplied definitions, no production execution)
- `protect_profile_stats()` is a BEFORE UPDATE trigger on profiles and restricts changes to is_vip, vip_expires_at, points, monthly_points, monthly_correct_scores and role when `auth.role() = 'authenticated'`; it does NOT itself restrict all other sensitive counters such as eligible_monthly_points and eligible_monthly_correct_scores, so check RLS and update grants. Target must use explicit per-field authorization and dedicated server mutations, not replace auth.role() with guesswork.
- `secure_predictions()` permits service_role bypass, validates kick-off time from matches for other roles, blocks core prediction edits and user attempts to change points/status, and only permits appending previously blank bonus markets. Audit issues: missing match row gives NULL kickoff and may avoid `NOW() >= match_start` rejection; does not itself validate prediction ownership, permissible values, eligible day limit or bonus unlock moment, and only protects a subset of columns. Inspect RLS and server pathways before rating actual exploitability. Settlement updates use service_role bypass.
- Preserve intended user behavior, harden its enforcement and add regression tests; do not blindly clone security implementation.

## Operational acceptance
1. All schema objects recreated and enumerated, with explicit tests.
2. All providers/automations repopulate content in staging safely; no old transactional rows imported.
3. Match-center/live updates and editorial pages work before games start.
4. New game starts with 0 points and accurate predictable rules.
5. No deleted old data or history during dev; source backup retained.
6. User-account, entitlement, editorial content and legal-retention decisions individually approved.
7. Separate snapshot for agent handoff and deployment checklist.
