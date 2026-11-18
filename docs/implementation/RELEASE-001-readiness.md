# Factsport v2 release gate — evidence and remaining scope

As of 2026-11-05, work is isolated to **refactor/factsport-v2**.

## Verified

- Cloudflare GitHub Actions authentication using existing `CLOUDFLARE_ID` and `CLOUDFLARE_KEY` repository secrets.
- Azure PostgreSQL 18 database `factsport_v2` has four core tables via verified migration [41669938819](https://github.com/MketyDigital/Factsport/actions/runs/41669938819).
- Private R2 bucket `factsport-v2-media-staging`, bound as `FACTSPORT_MEDIA_BUCKET`.
- Restricted `factsport_v2_reader` PostgreSQL role and `factsport-v2-runtime-postgres` Hyperdrive, ID `895cca4c06104b8ab9f7c1b72a8ba18f`. Runtime cannot INSERT into matches, and cannot read app_users. One-time proof: [41675097638](https://github.com/MketyDigital/Factsport/actions/runs/41675097638).
- Runtime Hyperdrive SQL query cache disabled, origin connections limited to 5, TLS require. Smoke checks: [41675554921](https://github.com/MketyDigital/Factsport/actions/runs/41675554921).
- Native Cloudflare vinext build, TypeScript and existing engine regression checks passed.
- Protected full application deployed as `factsport-v2-staging` on workers.dev with a randomly generated Worker-only staging access token.
- Unauthenticated staging root, match API and admin routes rejected. Authorized native `/api/v2/health` validated PostgreSQL and R2, and authorized `/api/matches` returned a JSON array through restricted Hyperdrive. Run: [41677323001](https://github.com/MketyDigital/Factsport/actions/runs/41677323001).
- Cloudflare schedule-only staging Cron deployed and its 03:15 and 15:15 UTC trigger registration verified: [41696849300](https://github.com/MketyDigital/Factsport/actions/runs/41696849300). The trigger is registered to invoke only the restricted writer and never changes scores or prize columns; **actual scheduled invocation and automatic refresh remain unverified** (the successful Actions run checked registration and protected health only).
- Football-data.org staging schedule sync and restricted writer verified: [setup 41695514082](https://github.com/MketyDigital/Factsport/actions/runs/41695514082), [five extra leagues 41696052184](https://github.com/MketyDigital/Factsport/actions/runs/41696052184), [nonempty native app matches 41695925330](https://github.com/MketyDigital/Factsport/actions/runs/41695925330). All imports avoid live/finished scores.
- Dedicated ESPN staging role `factsport_v2_espn_writer` and Hyperdrive `factsport-v2-espn-postgres` created with column-limited privileges; a separate connection verifier confirmed positive and negative permissions [42047371419](https://github.com/MketyDigital/Factsport/actions/runs/42047371419). A protected read-only reconciliation preview scanned 43 schedule fixtures and 57 ESPN events, yielding 18 unique candidates, zero ambiguous candidates and 39 no-match events [42050234345](https://github.com/MketyDigital/Factsport/actions/runs/42050234345). No rows were changed; all 18 candidate links still need review.
- No production route or DNS changes. Existing ESPN, GitHub scheduled tasks, Supabase, Mkety integrations and the disabled Azure Logic App remain untouched.

## Still required before live switch

1. **Fixture ingestion and data parity:** A separate least-privileged `factsport_v2_schedule_writer` and `factsport-v2-schedule-postgres` Hyperdrive are **completed**. Football-data.org scheduled fixtures have been imported for Premier League, La Liga, Bundesliga, Serie A, Ligue 1 and Champions League (121 insert/update operations in verified initial runs), and the protected app returns populated Premier League fixtures. **Still required:** review/approve the 18 dry-run ESPN ID candidates before any linking write, implement a staging-only score updater using the new ESPN writer, prove ESPN live-score parity and preserve the ~3s live refresh, plus H2H, R2/team media ingestion and a complete finished-round comparison.
2. **Authentication and accounts:** Replace legacy Supabase auth with the planned Entra External ID Basic implementation. Migrate user/identity references safely, protect paid/private routes, test sessions, user roles and privacy.
3. **Prize system / cron:** Add transactional predictions, points, settlements, retries and job_runs-based idempotency; verify end-to-end before enabling Azure Logic Apps Consumption and retiring legacy GitHub production syncs.
4. **Media:** Migrate necessary Supabase/Azure/OCI assets to Factsport R2 keys with access policies, correct content types, durable media URLs, rollback and cost controls. The R2 binding is working but no bulk media migration has occurred.
5. **Third-party services:** Port existing Mkety AI, email, Telegram, Facebook and other integration secrets into restricted Cloudflare Worker secrets only where needed. Do not dump existing GitHub service-role secrets into public staging.
6. **Release validation:** Automated coverage for live scores, matches, site pages, auth, points, load/rate limits, billing/usage, fallbacks, rollback and production domain setup. No main-branch or DNS cutover until parity is accepted.

The staging app is currently **not an end-user-ready production replacement**. It uses intentionally nonproduction Supabase placeholders to avoid exposing legacy service credentials, so historical pages and account flows do not have production feature parity.

## Namespacing

All new Cloudflare resources are prefixed `factsport-v2-`; all native bindings use `FACTSPORT_`. Original admin Hyperdrive `factsport-v2-postgres` is retained only for controlled migrations, while normal staging reads use `factsport-v2-runtime-postgres`.


## 2026-11-06 follow-up

- The staging matches API now sends `private, no-store` while token-gated. App staging run [42259985117](https://github.com/MketyDigital/Factsport/actions/runs/42259985117) passed the header assertion and authorized → unauthenticated → authorized same-URL sequence.
- ESPN reconciliation preview now uses the read-only runtime Hyperdrive and reader role rather than the ESPN writer. Run [42260972600](https://github.com/MketyDigital/Factsport/actions/runs/42260972600) passed: 48 fixtures scanned, 48 ESPN events normalized, 20 unique candidates, zero ambiguous, 28 no-match; zero writes.
- A read-only catalog privilege audit workflow is being added to verify the effective rights of all three database roles, including PUBLIC grants, memberships, functions, sequences and schema/database privileges. Do not widen or change role grants until its sanitized report is reviewed.
- The v2 schema and application feature parity remain incomplete; the staging app is not a production replacement.


## 2026-11-18 — current staging acceptance and remaining gates

The latest protected application staging run [44344593040](https://github.com/MketyDigital/Factsport/actions/runs/44344593040) succeeded on the refactor/factsport-v2 branch. It passed regression checks, TypeScript, native Worker build/deployment, deny-by-default routes, Entra authorization redirect/PKCE, restricted Hyperdrive connection to factsport_v2 with TLS, R2 health, PostgreSQL-backed /matches, populated fixtures, pagination and private/no-store auth/cache isolation. Only the separate staging Worker was deployed; production DNS, routes and data were not changed.

The sanitized read-only preflight found external_identities present and media_editorial_memberships absent. It found no migration tracking table and no checked editorial, prediction or broadcast runtime roles. This does not establish the complete migration history. The Entra start redirect passes, but interactive callback/session/account mapping does not; the Media editor database binding/roles/membership grants are not provisioned. Prediction and customer-auth journeys remain unimplemented or gated as listed in P0–P9.

No production cutover is approved by this evidence. Before Media release, reconcile schema/roles using a read-only admin audit, prove backup/restore, provision the dedicated editorial and Media-access roles/binding, apply reviewed migrations in order, link an approved editor identity, then complete browser/mobile/editorial/provider acceptance and P9A rollback rehearsal. Prediction remains a separate P9B release. The M78 plan keeps Factsport TV at P10 after Media and Prediction; its implementation has not started. Logic Apps remains disabled until its selected adapter, identity, cost/budget, idempotency, monitoring and delivery-reconciliation tests pass.


### 2026-11-18 follow-up — corrected runtime role inventory

The latest staging run [44346109481](https://github.com/MketyDigital/Factsport/actions/runs/44346109481) passed on attempt 2 after a transient 404 on the first attempt. The read-only inventory list was aligned with the current migration-verification role names. It confirms the existing roles factsport_v2_reader, factsport_v2_schedule_writer, and factsport_v2_espn_writer; each reports superuser=false, canCreateRoles=false, and canCreateDatabases=false. It reports these planned roles as absent: factsport_v2_editorial_writer, factsport_v2_media_automation_writer, factsport_v2_social_dispatcher, factsport_v2_media_broadcast_admin, factsport_v2_broadcast_token_issuer, factsport_v2_media_access_admin, and factsport_v2_prediction_api. public.external_identities exists; public.media_editorial_memberships does not. No migration tracking table was discovered. This still does not determine the complete applied schema history or backup/restore recoverability.

This successful retry re-verifies the narrow staging match-read and Entra-start paths only. Do not create missing roles or apply migrations until the admin-side read-only catalog/restore audit and reviewed migration plan are complete. No production resources or data were changed.


### 2026-11-18 admin-audit attempt — no database query performed

A follow-up read-only catalog audit was attempted with the existing temporary audit Worker workflow [44347722061](https://github.com/MketyDigital/Factsport/actions/runs/44347722061). Typecheck passed, but Cloudflare rejected deployment because the temporary Worker factsport-v2-db-role-audit did not exist in the account (API code 10007). The job failed before installing its audit token or opening the admin Hyperdrive; no database query, role change, schema write, or production change occurred. This leaves admin-side grant/migration audit and backup/restore evidence open. The application-worker read-only inventory from run [44346109481](https://github.com/MketyDigital/Factsport/actions/runs/44346109481) remains valid for current database identity, TLS, table presence, and expected-role existence only.


### 2026-11-18 — admin role audit result

The admin Hyperdrive read-only catalog audit passed in [run 44350082264](https://github.com/MketyDigital/Factsport/actions/runs/44350082264). A temporary audit Worker used the exact verified `factsport-v2-postgres` Hyperdrive target for `factsport_v2`, then was deleted. The database was not modified. The three inventoried runtime roles are non-superuser, non-inheriting, have no memberships, no database/role creation or replication rights, no public function/sequence rights, and no public object creation/temp-table rights. The reader has SELECT on `matches` only; schedule and ESPN roles retain narrow column privileges on `matches`.

This does not establish migration history or backup/restore recoverability. The planned editorial, media automation, social, broadcast, media-access and prediction runtime roles remain absent in the latest app inventory. Before migration writes, prove restore capability and inventory current schema/migration state; provision only reviewed staging roles and bindings. Production stays no-go.

### 2026-11-18 — current schema inventory

A second read-only admin audit, [run 44350763779](https://github.com/MketyDigital/Factsport/actions/runs/44350763779), passed after extending the worker to enumerate public relations and migration-ledger candidates. The target `factsport_v2` currently has exactly four public tables: `app_users`, `external_identities`, `job_runs`, and `matches`; it has no migration-ledger-like relation. Isolated verification also passed in [run 44350763506](https://github.com/MketyDigital/Factsport/actions/runs/44350763506). This confirms later Media/editorial, broadcast, community, and Prediction schemas are not present yet. Catalog inspection is read-only; no Azure database writes occurred. Next, verify backup/restore recovery before applying an ordered, reviewed staging migration plan. Disposable migration-chain CI is not proof that this Azure target has been migrated.

### 2026-11-18 — fresh V2 schema chain applied

The guarded staging migration workflow [44358887095](https://github.com/MketyDigital/Factsport/actions/runs/44358887095) completed successfully against the verified Azure PostgreSQL target `factsport_v2`, connecting as the administrative migration identity `mketydbadmin` through the exact V2 Hyperdrive. It applied all 49 ordered migrations, versions 0000–0048, and verified a contiguous SHA-256 migration ledger. No legacy operational data was restored or imported; the V2 clean-start target and existing V2 fixtures remain the intended source of truth.

This closes the applied-schema step for the V2 migration chain. It does not prove all Media/runtime roles and credentials are provisioned, create runtime Hyperdrive bindings/logins, complete the real Entra editor journey, complete Media/provider acceptance, enable the disabled Azure Logic App, or establish backup/PITR recovery. Production remains no-go. Continue with a separate read-only schema/role/ledger audit, then finish Media runtime provisioning and acceptance, recovery rehearsal, route isolation and P9A rollback/go-no-go before any Media cutover. Prediction remains P9B; Factsport TV remains P10 after Media and Prediction are stable.
