# Factsport v2 database and data migration matrix

**Updated:** 2026-11-06  
**Source inventory:** DB-001, DB-002 and DB-003  
**Target:** isolated Factsport v2 PostgreSQL on Azure, accessed through Cloudflare Hyperdrive; Cloudflare Workers and R2 for runtime/media.

## Binding reset decision

**Fresh data; full product.** Recreate the complete schema, rules, relationships, indexes, functions, triggers, roles, access policies, jobs and integrations, but start generated/transactional gameplay data at zero. Do not bulk-import legacy matches, scores, match events, predictions, points, leaderboards, standings snapshots, monthly winners, transient social posts or cron logs. Do not destroy or mutate the source database; preserve a backup and rollback access.

Manually authored original news/editorial content and associated assets are preserved only after provenance, rights and ownership review. User identity, VIP/paid entitlements, financial obligations, legal/compliance records and historical prize claims require separate approved decisions; a score reset does not extinguish contractual or user rights.

## Legacy table → v2 domain mapping

| Legacy table | v2 domain/table target | Default disposition | Required v2 behavior / acceptance |
|---|---|---|---|
| `automation_logs` | `job_runs`, `job_attempts`, `job_events` | Reset generated rows; recreate empty | Durable run key, lease/lock, attempts, structured failure, replay safety, retention and monitoring |
| `campaign_leaderboards` | `campaign_scores` / campaign leaderboard read model | Reset scores; recreate empty | Atomic score ledger, exact qualification rules, stable period/competition, deterministic ties |
| `campaigns` | `campaigns`, `campaign_rules`, `campaign_leagues` | Reseed reviewed templates/config; no old generated totals | Versioned rules, active windows, supported league IDs, first-five eligibility and reward policies |
| `cron_logs` | `job_runs`, `job_attempts` | Reset; recreate empty | One authoritative scheduler per job, UTC schedule, idempotency and alerting |
| `global_studio` | `studio_settings` | Reseed safe defaults; secrets externalized | Server RBAC, encrypted/provider secrets, change audit, safe public projection |
| `matches` | `matches`, `match_events`, `match_stats`, `match_lineups`, `match_provider_links` | Reset all rows; recreate schema and ingest new fixtures | Stable internal UUID; football-data.org fixture source; ESPN coverage/live source; canonical provider IDs; verified FT correction; no false zero scores |
| `monthly_winners` | `monthly_awards`, `prize_audits`, `prize_claims` | Reset generated awards; preserve separately approved outstanding claims/history | Only qualified candidates ranked; immutable qualification snapshot; approved ties/floors; idempotent period close |
| `news` | `articles`, `article_revisions`, `article_sources`, `article_media` | Preserve manually authored original content after provenance/rights review; reset transient AI-only roundups unless approved | Draft/review/publish, revisions, source provenance, slug uniqueness, rights metadata, rollback and SEO |
| `predictions` | `prediction_markets`, `prediction_rules` | Reset generated market instances; reseed reviewed rule templates | Versioned scoring, market availability, lock time, eligibility and validation |
| `profiles` | `app_users`, `user_profiles`, `user_roles`, `user_sessions` | Identity migration/recreation requires separate approval; no passwords copied | Stable Factsport UUID, OIDC external subject link, server-derived roles, secure session/recovery and privacy |
| `site_settings` | `app_settings`, typed feature/config tables; credentials in Cloudflare secrets | Reseed reviewed non-secret defaults; never copy legacy secret values | Safe public config projection, schema validation, audit history, secrets separated from DB |
| `standings` | `standings_snapshots`, `standing_rows` | Reset snapshots; recreate and regenerate from new fixtures/results | Season/group-aware identity, deterministic tie-breaks, source freshness, atomic snapshot swap |
| `subscriptions` | `entitlements`, `subscription_orders`, `payment_proofs`, `payment_events` | Paid status and financial obligations require separate approval; don't blindly reset/transfer | Verified payment state, webhook reconciliation, expiry, idempotent grant/revoke and immutable audit |
| `team_logos` | `media_assets`, `team_media` with R2 object keys | Recreate reviewed curated assets; no bulk legacy binary copy without rights/quality review | R2 object lifecycle, MIME/size checks, signed/private media access, metadata and rollback |
| `teams` | `teams`, `team_aliases`, `competitions` | Reseed reviewed canonical team/competition mappings | Provider alias mapping, canonical IDs, season/league support, logo references |
| `top_players` | `player_stats` / leaderboard read model | Reset and regenerate | Clearly defined metric/period, source provenance, privacy-safe read model |
| `tournament_scorers` | `competition_scorers` | Reset and regenerate | Competition/season/player identity, provider source, tie ordering and freshness |
| `user_predictions` | `predictions`, `prediction_markets`, `prediction_audit` | Reset gameplay history; recreate empty tables | User ownership, first-five eligibility, cutoff, append-only corrections, settlement ledger and exactly-once scoring |

The v2 migration `0001_factsport_core.sql` currently creates only four foundation tables (`matches`, `app_users`, `external_identities`, `job_runs`). This matrix is the target-domain inventory, not a claim that all target migrations exist. Additional schema migrations must be designed and tested before production cutover.

## Required supporting database objects

Recreate deliberately and securely, not by blindly copying legacy SQL:
- enum/types, PK/FK/unique/check constraints, indexes and safe views;
- RLS or explicit equivalent server-only access policies; force RLS only where the role model requires it;
- functions/triggers for prediction validation, profile protection, settlement, standings and user lifecycle;
- least-privilege roles for app read, sports schedule writer, ESPN live writer, user/session services, admin and migrations;
- durable job/outbox/settlement ledgers and unique idempotency keys;
- retention/cleanup schedules, backups, restore validation and monitoring.

Legacy function audit requires special care:
- `settle_match_points` currently awards 3 outcome + 10 exact-score points (13 total for exact outcome/score), has campaign-specific awards, and is not proven idempotent under concurrent calls. Reimplement as a transaction with match locking and unique settlement ledger, plus corrections/reversals.
- `secure_prediction_insert` exists but was not attached to `user_predictions`; only `secure_predictions` trigger was attached. The app writes `is_eligible_for_prize:false`, so the first-five eligibility marker must be correctly implemented in v2 server/domain logic.
- `audit_monthly_winners` SQL and app audit disagree on exact-score points/ranking. Reconcile documented rules and tests before migration.
- `refresh_group_standings_from_matches` references an absent `group_standings` relation in the supplied inventory. Implement against the actual v2 standings schema, not the stale function.

## Migration phases and gates

1. **Inventory and source protection:** schema columns/constraints, triggers, RLS, function bodies, grants, cron jobs, storage and content provenance. Snapshot/backup legacy source; no writes.
2. **Foundation:** migrations for identity, teams/competitions, matches/provider links, settings, media, jobs, audit and roles. Apply to isolated staging only.
3. **Sports ingestion:** controlled fresh fixture bootstrap, provider alias reconciliation, ESPN coverage mapping, standings, FT verification and source-health tests. No old match history.
4. **Gameplay:** predictions/eligibility, point ledger, settlement, campaigns, VIP/entitlements and monthly awards. Start all balances/history at zero unless explicitly approved exceptions.
5. **Editorial/media:** preserve reviewed original news content, R2 assets, source provenance, editor roles, review/publish/revisions and SEO.
6. **Community/other integrations:** chat, MOTM, stream entitlements, direct Facebook/Telegram, Logic Apps adapters, Mkety AI/Mail and Google indexing.
7. **Rehearsal:** empty-data bootstrap, seed reviewed config, exercise all journeys, replay/concurrency, backup/restore, provider outage, rollback and cutover.
8. **Cutover:** only after sign-off; route/DNS switch, monitor, retain legacy read-only backup, and retire old schedulers only after verified v2 ownership.

## Prohibited shortcuts

- Do not truncate or delete the legacy database as part of v2 development.
- Do not copy legacy match/prediction/points history simply to make leaderboards look populated.
- Do not silently erase original authored news, payment evidence or prize claims.
- Do not migrate secrets, passwords, tokens or service-role credentials.
- Do not enable both legacy and v2 production schedulers against the same data without explicit dual-run/idempotency design.
- Do not call settlement, reset, cleanup or destructive cron functions during audit.


## 2026-11-07 V2 editorial/homepage schema additions

The following migrations are additive and checked in on `refactor/factsport-v2`; they have **not** been applied to Azure PostgreSQL.

| Migration | New domain structures | Data/reset rule |
|---|---|---|
| `0004_factsport_editorial_media.sql` | `editorial_articles`, article revisions/source provenance, `media_assets`, article-media links, published editorial/media read views | Create empty. Do not copy old news bodies or image URLs until article origin, rights and ownership are reviewed. |
| `0005_factsport_editorial_provenance_review.sql` | Origin classification, original timestamps, legacy body/content preservation fields, SEO/reverification, human review and media-rights review | Default origin is `unknown`; never infer human authorship from slug/author. Publishing requires a recorded reviewer. Keep legacy body and content fields distinct in any private preservation export. |
| `0006_factsport_homepage_sports_read_models.sql` | Featured-match flags, safe homepage setting view, `matches.season`, season/group-aware standings, completed-results index, match highlights with provider and rights checks | Fresh operational data only. Do not import legacy standings snapshots or highlight URLs automatically. Rebuild standings from new provider ingestion and manually approve highlight rights. |
| `0007_factsport_competition_player_stats.sql` | Season-aware current player goals/assists, team identity and provider freshness; public-only player-stat view | Create empty. Do not bulk-import legacy scorer rows until player identity, nullable legacy IDs, season and source are reconciled. |

Reader access is SELECT-only on the narrowly projected public views. Editorial write tables, revisions, source metadata, homepage settings, standings write tables and highlight records are not granted to the public reader. The match read adapter continues to project an explicit public DTO and excludes settlement flags.

The homepage read model is intentionally not a substitute for the full CMS or sports ingestion workflows. Migration 0006 creates the target shapes; provider jobs, CMS commands, admin/RBAC and actual staging data validation remain separate deliverables.




## 2026-11-07 match identity alias migration

- Added unapplied migration 0008 with nullable unique legacy Supabase match UUID alias. It does not rewrite the V2 canonical matches.id primary key or alter any prediction foreign key.
- Added a PostgreSQL reader that resolves either the canonical V2 UUID or the legacy alias and always returns the canonical V2 ID.
- Added an independently gated same-origin match detail API branch using only public match fields. It deliberately excludes raw stream URLs, audio/video links, pro_analysis, campaign_id, affiliate links and settlement flags.
- No legacy IDs have been imported or mapped yet. Migration 0008 remains unapplied; alias population requires an approved, reconciled import/crosswalk.


## 2026-11-08 Media data additions

- `0027_factsport_revision_inline_media_gallery.sql`: ordered revision-scoped inline media and public gallery projection filtered to published/reviewed articles and rights-cleared, unexpired assets.
- `0028_factsport_broadcast_admin_audit_and_role_history.sql`: active-only unique broadcast room-role grants so revoked roles can be re-granted without deleting history; extends audit action coverage.
- `0029_factsport_broadcast_token_rate_limits.sql`: keyed-hash rate-limit buckets for Stream token issuance; no raw IP or invite token values persisted.
- These migrations are committed but not applied to staging or production. Apply only after dedicated editorial/broadcast roles and Hyperdrive bindings are provisioned; validate existing data and grants first.
