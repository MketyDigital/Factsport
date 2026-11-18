# M77 — Current V2 implementation and cutover readiness

Date: 2026-11-16  
Repository: `MketyDigital/Factsport`  
Branch: `refactor/factsport-v2`  
Purpose: reconcile the plans, roadmap, migration and product matrices, handoffs, and explicit V2 non-use decisions. This is a status record, not a release approval.

## Executive state

V2 is an active refactor with meaningful verified source and a narrow protected staging acceptance slice. It is not a complete replacement for the current product, and it is not production-ready. Source presence, compilation, or a health endpoint does not mean that customer journeys, provider provisioning, data migrations, or operational acceptance are complete.

The current immediate technical blocker from M76 is resolved locally: exact package pins produce the Cloudflare Build Output format consumed by `cf`. Local engine checks, TypeScript, Worker build, and prebuilt dry-run pass. The updated branch passed isolated verification (`43888295007`), native Worker build (`43888295073`) and protected app staging (`43888294900`). The protected staging workflow passed its intended access denial, Hyperdrive/R2 health, PostgreSQL `/matches` render, keyset pagination and cache/auth-isolation checks.

## Completed or implemented, with evidence boundaries

| Area | Implemented / verified | Boundary still applying |
|---|---|---|
| Cloudflare/Vinext | ISR adapter uses Workers Cache; typed Worker cache configuration; unsafe unused Cloudinary credential-forwarding rewrite removed. Plugin and CLI pinned to `2.0.0-beta.v.17` and `1.0.0-beta.32`. | Exact pinned local build emits `v0`; `cf deploy --prebuilt --mode production --dry-run` reads 131 assets and staging bindings, exits before upload. Not a remote staging deploy. Whole dependency graph is not locked. |
| Local and branch CI gates | Engine suite: 275/275. TypeScript: pass after removing build-generated Cloudflare declarations. Vinext Worker build: pass. Isolated verification `43888295007`, native Worker build `43888295073` and protected staging `43888294900` succeeded on commit `0980fc374168627a7e49e3bb113aca10f4602834`. | Full lint, browser, security, load and provider tests remain. |
| Database foundation | Earlier release evidence records Azure PostgreSQL database `factsport_v2`, restricted reader/schedule/ESPN writer roles and Cloudflare Hyperdrives; migration CI covers the repository chain. | These are historical slices. Reconcile the actual staging migration versions, role grants, restore point and current Worker bindings before further staging writes. Migrations 0044–0048 are not accepted/applied in the evidence reviewed. |
| Matches | A prior protected staging run accepted PostgreSQL-backed `/matches` and its bounded API path, with deny-by-default and cache/auth isolation checks. Schedule and ESPN ingestion/reconciliation source/jobs exist. | Not full match-centre parity. Exact legacy deployed fast-score/chat/MOTM worker source was missing at M69; 3-second viewer path, full match lifecycle, conditional provider fallback, current staging status and provider accuracy remain open. |
| Media/editorial | Many CMS, media, rights/provenance, derivatives, Stream upload/room, social outbox/adapters, live center, ratings and visual changes exist in source and handoffs M35–M75. | Migrations, provider credentials, real Stream rooms/webhooks, private social deliveries, editorial workflow/RBAC, browser/mobile/accessibility, match-centre parity and production evidence remain incomplete. Do not promote source-only milestones to complete runtime features. |
| Public predictions | Migration 0003 and later scoped submit-function/API work add anonymous secure submission boundaries, participant cookie, email on submission, optional unticked marketing consent, host gate and feature flag. | Feature stays off. Public reads/history/leaderboard, account claim, campaign/bonus, official score settlement, audit/monthly rules, VIP/payment, real dedicated role/binding, migration acceptance and browser E2E remain open. |
| Customer identity | Identity interfaces/mapping groundwork and a separate Entra adapter for Media editors exist. | Per latest owner direction, customer user sign-in is Entra External ID in a customer external tenant. The tenant resource exists; application registrations, runtime secrets, callbacks, session/account/recovery journeys and real staging tests remain unverified. Media editor identity is not customer auth. |
| Azure Logic Apps | Disabled-by-default workflow template and Logic Apps/APIM adapter seam exist for approved Buffer/Make-style distribution. | Azure owner output confirms a Logic Apps resource `la-factsport-v2-staging` in `rg-factsport-v2-staging` / `westus`. Workflow state/actions, API connections, role/identity/secrets, provider credentials, schedule, monitored run and delivery/reconciliation E2E remain unverified. Facebook and Telegram remain direct integrations. |
| Staging operations | Protected `factsport-v2-staging` Worker deployed on commit `0980fc374168627a7e49e3bb113aca10f4602834`. Workflow checked unauthorized 404 for `/`, `/api/matches`, `/admin`, `/matches`; authorized Hyperdrive+R2 health; initial `/matches` page; populated PostgreSQL fixtures; timestamp+UUID pagination; private/no-store and auth/cache isolation. | This is narrow app staging acceptance. Full migration, restore, alerting, logs, rollback, cost, workload and all product journeys remain open. |

See the master `ROADMAP.md`, `PRODUCTION-EXECUTION-PLAN.md`, `PAGE-MIGRATION-MATRIX.md`, `ROUTE-MIGRATION-MATRIX.md`, `COMPONENT-MIGRATION-MATRIX.md`, `DB-003-functions-and-cron.md`, AUTH-004/AUTH-005, and M44–M76 for per-feature source and acceptance evidence. P0–P9 remain the ordered release gates.

## Prediction and identity: remaining product work

1. Provision the dedicated Entra External ID customer tenant and separate application registration(s); set exact issuer, client IDs, allowed origins/redirects, server-side secrets, session keys and cookie domains in the approved secret stores. Keep email matching from auto-linking old accounts. Define verified account recovery, duplicate-account conflict, consent and deletion handling.
2. Implement/accept customer registration, login, logout, session refresh, internal immutable UUID mapping, roles, entitlements, abuse controls and host isolation on the private Predict surface. Keep Media editor identity separate.
3. Reconcile Prediction migration state and grants on isolated Azure staging, especially 0044–0048 and any Prediction/community roles. Keep flags off until function privilege checks and rollback-only acceptance pass.
4. Finish public prediction reads/history/leaderboards; registered-account claim/migration; campaign and bonus lifecycle; official match event mapping; scoring, idempotent settlement, correction, reconciliation and audit ledger; monthly qualification, winner, reset and dispute policy; VIP/payment/entitlement, refunds and notifications.
5. Preserve the M44/M49 constraints: the legacy dormant eligibility trigger is not safe to attach as-is; legacy scoring/prize/monthly implementations conflict. Do not invent or activate prize, VIP, monthly, payment or migration behavior until owner policy is recorded and the full end-to-end tests prove it.
6. Run anonymous and signed-in browser journeys, consent/refusal, cookie expiry, cross-host leakage, email conflict, duplicate callback, concurrent submission, kickoff races, replay/settlement idempotency, adjustment and rollback tests.

## Azure and Logic Apps provisioning still needed

- Reconcile the owner subscription resource inventory with the historical Azure PostgreSQL evidence: region, server/database identity, networking allowlist/TLS, backup retention/PITR, restore proof, health, actual migration versions, roles/grants, Hyperdrive mappings and cost/budget alerts. Do not infer existence/configuration from source or old run notes.
- Provision the dedicated Entra External ID tenant/apps and approved Cloudflare secrets, then run real OIDC staging sign-in and recovery acceptance.
- If external Buffer/Make-style distribution is approved, provision Logic Apps **Consumption** only after region, billing and budget review. Configure one clear job owner, authenticated APIM/connection, least-privilege workflow role, server-only credentials, private destination tests, durable idempotency/retries, dead-letter/unknown-outcome reconciliation and alerts. The template remains disabled until this passes.
- Do not provision or assume any Azure item absent approval/evidence: workforce-tenant customer auth, Logic Apps Standard, Functions, Azure OpenAI, ACS Email, Redis, Service Bus, VM/AKS, Azure Blob or Cosmos. Use Mkety AI/Mail adapters where selected, and keep replaceable provider boundaries.

## Explicit V2 non-use / do-not-carry-forward list

- Do not use the legacy workforce Entra tenant for customer identities. Use the dedicated customer external tenant for Entra External ID; isolate it from Media editor auth.
- Do not use legacy Supabase sessions or mutations as the V2 Media/Admin/Prediction runtime. Archived legacy endpoints remain fail-closed; no blind legacy account/history import and no unsafe SQL monthly reset/standings functions.
- Do not activate D1 or browser calls to old external Workers. Recover missing Worker source/config only by read-only authorized inventory; implement and verify the V2 same-origin Postgres path before retiring anything.
- Do not switch to OpenNext. Do not re-add the Cloudinary `/cdn/*` rewrite that forwards credentials. Use Vinext, Workers Cache, Azure PostgreSQL through server-side Hyperdrive, and R2 within the approved architecture.
- No query-string cron keys; no database access from the browser; no app use of the admin Hyperdrive; no duplicate scheduler/job owners; no moving 3-second ESPN display polling into PostgreSQL/Logic Apps.
- Keep direct Facebook Graph API and Telegram Bot API adapters direct; Logic Apps is only for the approved third-party distribution layer. Never enable a disabled workflow based on template existence.
- Do not enable paid Cloudflare Stream hosted VOD, unapproved paid Azure services, or resources outside the selected architecture without an explicit architecture/cost change.
- Keep clean-start policy: no generated historical matches, scores, gameplay, prediction points/rankings or transient logs. Preserve/review human-authored editorial content, identities, paid entitlements and legal/financial obligations; do not delete or migrate them by guess.
- Do not activate AdSense until actual publisher approval, public-domain readiness, ads.txt/crawlability, consent/privacy, sports betting policy and page-surface rules are verified. No ad code on private, account, chat, payment or admin surfaces.

## Exact next gates

1. **Completed:** package pins delivered to `refactor/factsport-v2`; isolated verification, native Worker build and protected app staging passed at commit `0980fc374168627a7e49e3bb113aca10f4602834`.
2. Read-only reconcile Azure and Cloudflare staging resources and migration state. Apply only owner-approved migrations to isolated staging; validate roles, rollback, backups and restore. Keep unaccepted capability flags—especially Prediction, identity, community and media write/provider paths—disabled until their gates pass.
3. Finish customer Entra External ID implementation/provisioning and the Prediction, Media, match-centre, community, job and provider journeys in roadmap order.
4. Complete browser/mobile parity, accessibility, SEO/consent, privacy, adversarial/security, dependency, load, observability, backup/restore, and rollback evidence.
5. Complete shadow comparisons and full match + account + payment/VIP/prize lifecycle rehearsal. Resolve open policy/data obligations and secure explicit written owner go/no-go.
6. Only after P0–P9 pass, deploy the production Worker with production-specific bindings/secrets, rehearse canary and rollback, then perform approved DNS/route cutover. Preserve legacy system/backups until stable acceptance.

## Current no-go

**Staging:** narrow protected app deployment and probes pass on commit `0980fc374168627a7e49e3bb113aca10f4602834`; all broader acceptance remains open.  
**Production:** no-go. Media and Prediction release gates in P0–P9 remain open; no production Worker deploy, DNS change, legacy shutdown, production data write or cutover is claimed. The TV specification was added afterward and is integrated separately in M78/P10, after Media and Prediction.


The subsequent Factsport TV design addition and owner-directed phased release order are recorded in [M78](./M78-FACTSPORT-TV-AND-PHASED-RELEASE.md). The first Azure inventory corrections are recorded in ROADMAP M79; this does not establish PostgreSQL absence because the initial listing was filtered by resource name/group.

## M79 Azure evidence update — 2026-11-16

The owner's Cloud Shell output establishes that the Azure Flexible Server and database already exist: `mketypostgres` in `mkety_group`, West US, Ready, PostgreSQL 18, `Standard_B1ms`, 32 GiB, seven-day backup retention; database `factsport_v2` is present. The prior filtered resource query missed it because the server name/resource group did not contain “factsport”. The legacy bootstrap creates a new PG16 server and must not be run with `APPLY=1`; a duplicate-database guard was added before any provisioning.

The same output confirms `la-factsport-v2-staging` is Disabled, with a five-minute recurrence and only `NonMutatingDesignOnly`. No API connections were listed in the staging group and no subscription budgets were listed. It is not an active social delivery integration. The `factsports.onmicrosoft.com` External ID tenant exists; customer app registrations, credentials, callbacks and OIDC journeys remain unverified.

Still required: a clean read-only server firewall/TLS and networking inventory; actual database role/grant and migration ledger evidence; proof that the intended Cloudflare Hyperdrive maps to this exact server/database/least-privilege role; backup/PITR and restore proof; and the customer app registration/OIDC configuration. The prior firewall command returned `UNAVAILABLE` after terminal paste corruption, so it is not evidence that no firewall rules exist. No Azure cloud resource was changed.

## M79 PostgreSQL network evidence — 2026-11-16

The owner's Cloud Shell screenshot shows the PostgreSQL server's `publicNetworkAccess` is `Enabled`, `subnetId` is null, and 15 IPv4 firewall rules are listed under `mketypostgres`. This is a public endpoint restricted by firewall allowlists, not private network integration. The database-detail command failed with `unrecognized arguments: --database-name factsport_v2`; metadata output was not obtained.

The listed rules align with Cloudflare IPv4 ranges except `factsport-cf-04`, shown as `104.16.0.0–104.31.255.255`. Cloudflare's current published ranges list `104.16.0.0/13` and `104.24.0.0/14` separately; `factsport-cf-04` therefore includes `104.28.0.0–104.31.255.255`, outside those published ranges. Record as firewall drift and verify the exact intended Hyperdrive/Cloudflare egress path before a carefully scoped rule correction. Do not make a live firewall change based only on the screenshot. Source: https://developers.cloudflare.com/fundamentals/concepts/cloudflare-ip-addresses/.

No Azure network settings or firewall rules were changed. Next: re-run the database metadata command using the Cloud Shell CLI's accepted syntax; inspect the Hyperdrive target and TLS/role configuration without outputting secrets; then validate migration state and backup/restore.

## Entra code/configuration reconciliation — 2026-11-16

Source review of `lib/auth/entra-external.ts` and `app/api/auth/entra/*` shows an implemented, host-restricted OIDC/PKCE sign-in path for the **Media editor/admin surface**. It requires `ENTRA_EXTERNAL_DISCOVERY_URL`, `ENTRA_EXTERNAL_ISSUER`, `ENTRA_EXTERNAL_CLIENT_ID`, `ENTRA_EXTERNAL_REDIRECT_URI`, and `FACTSPORT_AUTH_SESSION_SECRET` (base64url-encoded 32-byte key). The current code does not read or use `ENTRA_EXTERNAL_CLIENT_SECRET`; do not add one without a deliberate confidential-client code change. Callback sign-in only succeeds for an issuer/subject already linked in `public.external_identities`; it is not self-service account creation.

This is **not yet customer Entra sign-up/login or Prediction account auth**. Public customer identity, account linking/claim, recovery, registration, entitlements, and Prediction host flows remain unfinished. The staging deployment now accepts all five values as GitHub Actions secrets, validates them as an all-or-none set (HTTPS endpoints, exact callback path, canonical 32-byte session key), and includes them only in the staging Worker's secrets file. If none are set, Entra stays disabled. This is configuration plumbing only; sign-in still needs a real External ID user flow, a linked editorial identity, and staging end-to-end acceptance. The existing `DATABASE_URL` is a privileged PostgreSQL setup/migration credential and is unrelated to Entra registration. Keep it inside a reviewed, sanitized workflow; never paste or log its value. The app uses Cloudflare Hyperdrive for runtime DB access.


## M81 staging Entra/browser and DB preflight follow-up — 2026-11-17

The owner confirmed the External ID user flow is attached to the `Factsportv2` app and all five Media OIDC/session repository secrets have been added. A staging-only middleware exception now allows `/media-login`, the exact Entra start/callback/logout endpoints, and `/admin/*` only when the Media session cookie is present. Server-side admin layout/actions still decrypt the JWE and check the linked `(issuer, subject)` plus active editorial membership. The rest of staging remains behind its temporary CI token. No Cloudflare Access policy was enabled, and no production route was changed.

The current staging Worker configuration still lacks `FACTSPORT_EDITORIAL_HYPERDRIVE`. This must be a dedicated least-privilege Hyperdrive/role to the existing Azure `factsport_v2` database; do not create a second database or substitute the public reader. The login page will continue to show not-provisioned until migrations, role/grants, binding and existing identity mapping are reconciled. Full interactive callback success is not yet verified.

The first standalone direct-DB workflow used `DATABASE_URL` but run `44161479046` failed with `CONNECT_TIMEOUT` from the GitHub-hosted runner; the secret was present and no SQL writes occurred. That workflow was removed. A sanitized, read-only inventory endpoint now uses staging Hyperdrive and is called by the existing `v2-app-staging.yml` workflow with its short-lived CI token; this combines browser-route, app acceptance and database inventory in one manual dispatch. The latest integrated workflow result is not yet verified. Commits: `bb0f8ac`, `88938c7`, `472a863`, `5c9834e`, `92d46ac`, `76f1f87`, `9c53f22`, `339bca3`, `e810352`. Current push-triggered Actions results are not yet verified from the available commit-status view; do not report them as passing.

**Next:** read the preflight and staging workflow logs; reconcile actual migration ledger and Hyperdrive target against the confirmed Azure database; provision only missing staging prerequisites using reviewed SQL and least-privilege roles; link the owner’s Entra `(issuer, subject)` to an existing internal user; then run an interactive sign-in and CMS authorization journey. Keep Prediction, TV, Logic Apps activation and production cutover in their planned order and blocked by their remaining gates.


## M82 staging evidence update — 2026-11-18

The manually dispatched protected application workflow and the follow-up staging runs now provide current evidence. The latest run, [44344593040](https://github.com/MketyDigital/Factsport/actions/runs/44344593040), completed successfully on the refactor/factsport-v2 branch at 3f9200d9b8f347c87d17b1ab155b41db148f28d2. Engine regression checks, TypeScript, the native Worker build and staging deployment passed. The protected staging checks verified anonymous 404s, the browser Entra authorization redirect with PKCE, Azure PostgreSQL factsport_v2 over TLS through the restricted factsport_v2_reader Hyperdrive, private R2 health, PostgreSQL-backed /matches, populated match results, pagination and cache/auth isolation.

The run also surfaced the present Media DB boundary: public.external_identities exists, but public.media_editorial_memberships does not; the checked V2 editor, prediction and broadcast roles are absent. No migration tracking table was discovered, so the actual migration ledger remains unverified. The report is read-only and does not prove which migrations were applied. Entra start is verified, but a real callback/session/account mapping and Media authorization journey are not; no editorial writer Hyperdrive is configured.

The first preflight failures were traced and corrected in staging middleware/query handling. Those fixes did not apply SQL or change production. Use run 44344593040 as the latest narrow staging acceptance evidence; it does not close full Media parity, Prediction, customer identity, restore, Logic Apps, or P9 production-release gates.

Before any further database writes: establish a recoverable backup/restore point; reconcile actual schema/migration state and least-privilege role grants through an authorized read-only audit; then apply only reviewed, ordered migrations to factsport_v2, provision the dedicated Media access/editorial roles and Hyperdrive, and re-run end-to-end authorization. Keep production DNS/routes, the legacy product and all Logic Apps disabled. M78's phased order remains in force: Media-only release first if isolated; Prediction separately; Factsport TV after those phases.


### 2026-11-18 follow-up — corrected runtime role inventory

The latest staging run [44346109481](https://github.com/MketyDigital/Factsport/actions/runs/44346109481) passed on attempt 2 after a transient 404 on the first attempt. The read-only inventory list was aligned with the current migration-verification role names. It confirms the existing roles factsport_v2_reader, factsport_v2_schedule_writer, and factsport_v2_espn_writer; each reports superuser=false, canCreateRoles=false, and canCreateDatabases=false. It reports these planned roles as absent: factsport_v2_editorial_writer, factsport_v2_media_automation_writer, factsport_v2_social_dispatcher, factsport_v2_media_broadcast_admin, factsport_v2_broadcast_token_issuer, factsport_v2_media_access_admin, and factsport_v2_prediction_api. public.external_identities exists; public.media_editorial_memberships does not. No migration tracking table was discovered. This still does not determine the complete applied schema history or backup/restore recoverability.

This successful retry re-verifies the narrow staging match-read and Entra-start paths only. Do not create missing roles or apply migrations until the admin-side read-only catalog/restore audit and reviewed migration plan are complete. No production resources or data were changed.


### 2026-11-18 admin-audit attempt — no database query performed

A follow-up read-only catalog audit was attempted with the existing temporary audit Worker workflow [44347722061](https://github.com/MketyDigital/Factsport/actions/runs/44347722061). Typecheck passed, but Cloudflare rejected deployment because the temporary Worker factsport-v2-db-role-audit did not exist in the account (API code 10007). The job failed before installing its audit token or opening the admin Hyperdrive; no database query, role change, schema write, or production change occurred. This leaves admin-side grant/migration audit and backup/restore evidence open. The application-worker read-only inventory from run [44346109481](https://github.com/MketyDigital/Factsport/actions/runs/44346109481) remains valid for current database identity, TLS, table presence, and expected-role existence only.


### 2026-11-18 follow-up — read-only admin role audit passed

The read-only admin catalog audit completed successfully in [run 44350082264](https://github.com/MketyDigital/Factsport/actions/runs/44350082264) after pinning Wrangler to the last known-good 4.158.0 release. The temporary audit Worker was deleted by the workflow. It verified the exact admin Hyperdrive identity and queried PostgreSQL database `factsport_v2`; no schema, roles, grants, data, or production resources were changed.

The report identifies `mketydbadmin` as database owner and finds only the three existing runtime roles: `factsport_v2_reader`, `factsport_v2_schedule_writer`, and `factsport_v2_espn_writer`. All three are login roles with connection limit 5, no superuser/create-role/create-database/replication/BYPASSRLS rights, and no inherited roles or memberships. Each can connect and use the public schema but cannot create objects there or create temporary tables. No public functions or sequences are executable/usable by them. On the current `matches` table, reader has SELECT only; schedule writer has its listed fixture insert/update columns; ESPN writer has its listed live-score/event update columns and SELECT. The role audit and app preflight both leave the applied migration ledger and recoverable backup/restore evidence unresolved. Planned editorial, media automation, social, broadcast, media access and prediction roles are still absent per the app inventory; do not infer missing schema solely from role absence.

Next gate: establish and verify a recoverable backup/restore path; separately inspect the full current schema and migration state; then stage only reviewed migrations and least-privilege roles/bindings. Keep all feature flags off until their staging probes pass. Production remains no-go; Media, Prediction and TV remain in the M78 order.

### 2026-11-18 follow-up — current V2 schema inventory

The extended, read-only admin catalog inventory passed in [run 44350763779](https://github.com/MketyDigital/Factsport/actions/runs/44350763779), with isolated verification also passing at [run 44350763506](https://github.com/MketyDigital/Factsport/actions/runs/44350763506). In `factsport_v2`, the public schema currently contains exactly four relations, all tables: `app_users`, `external_identities`, `job_runs`, and `matches`. No migration-ledger-like relation was found. The only present application roles are the three previously audited runtime roles. This is a read-only catalog result; no SQL writes were performed.

This establishes that the current DB contains the four-table foundation, not the later editorial/media, broadcast, community, or prediction schema. It does not create a migration history for the prior 0001/0002 effects. Do not replay the full chain blindly: first prove a recoverable backup/restore copy, then run a read-only schema preflight against the restored/staging target and apply a reviewed, idempotency-checked ordered migration plan. The full CI migration chain verifies syntax/behavior on a disposable PostgreSQL database, not the current Azure database.

### Owner clarification — clean V2 target, no legacy restore

The V2 database is the intended clean-start target. Do not request or perform a legacy database restore/import as part of the migration: generated operational history starts empty, and existing new V2 fixture rows are retained. The current read-only inventory shows the four core foundation tables in `factsport_v2`; it is not a source database awaiting restoration. The P1 backup/PITR item in the release plan is a later recovery-resilience check of the V2 target before production release, not a prerequisite to implementing the schema or a request to restore legacy data. Proceed with reviewed forward migrations and keep production unchanged until its separate release gates pass.

### 2026-11-18 — fresh V2 schema chain applied

The guarded staging migration workflow [44358887095](https://github.com/MketyDigital/Factsport/actions/runs/44358887095) completed successfully against the verified Azure PostgreSQL target `factsport_v2`, connecting as the administrative migration identity `mketydbadmin` through the exact V2 Hyperdrive. It applied all 49 ordered migrations, versions 0000–0048, and verified a contiguous SHA-256 migration ledger. No legacy operational data was restored or imported; the V2 clean-start target and existing V2 fixtures remain the intended source of truth.

This closes the applied-schema step for the V2 migration chain. It does not prove all Media/runtime roles and credentials are provisioned, create runtime Hyperdrive bindings/logins, complete the real Entra editor journey, complete Media/provider acceptance, enable the disabled Azure Logic App, or establish backup/PITR recovery. Production remains no-go. Continue with a separate read-only schema/role/ledger audit, then finish Media runtime provisioning and acceptance, recovery rehearsal, route isolation and P9A rollback/go-no-go before any Media cutover. Prediction remains P9B; Factsport TV remains P10 after Media and Prediction are stable.


### 2026-11-18 follow-up — V2 schema and role audit passed

The guarded clean-start apply [44358887095](https://github.com/MketyDigital/Factsport/actions/runs/44358887095) applied migrations 0000–0048 (49 total) to `factsport_v2`; the separate read-only audit [44360257808](https://github.com/MketyDigital/Factsport/actions/runs/44360257808) confirms 49 contiguous, checksum-valid ledger rows and 80 public relations. It found all 11 planned capability roles, all NOLOGIN, non-superuser, non-inheriting and without role/database creation, replication or RLS-bypass rights; no role memberships, schema CREATE/TEMP or unexpected public functions/sequences. Expected narrow editorial, community and Prediction functions are present. No legacy data restore/import occurred.

This supersedes the earlier “four tables/no ledger” status. The actual V2 schema is now present, including Media/editorial/broadcast/community and Prediction tables/functions. It does not provision LOGIN identities or the corresponding dedicated Hyperdrive bindings. Media host/editor Entra end-to-end, provider credentials/dispatch, Logic Apps provisioning, backup/PITR rehearsal, browser/mobile acceptance, route isolation, rollback and P9A go/no-go remain open. Prediction stays a separate P9B release; TV remains P10 and implementation is deferred.


### 2026-11-18 follow-up — isolated editorial runtime deployed to staging

The staging-only editorial runtime bootstrap [44362059881](https://github.com/MketyDigital/Factsport/actions/runs/44362059881) completed successfully. It created the restricted factsport_v2_editorial_app LOGIN identity through the guarded temporary Worker, with membership only in factsport_v2_editorial_writer, connection limit 5, and no broad database/schema privileges. A separate TLS-required, cache-disabled Hyperdrive was created and the temporary bootstrap Worker was removed. Its binding ID is stored in the V2 staging app configuration; generated credentials were not printed or committed.

The V2 app staging workflow [44362390781](https://github.com/MketyDigital/Factsport/actions/runs/44362390781) passed on commit 3b1ef8fe79bbd39baea790bf747d81def0bda6f8: regression suite, TypeScript, native Worker build, protected staging deploy, access denial, and staging checks all succeeded. This confirms the new binding is compatible with the deployed staging Worker; it does not prove a real Entra login or editor workflow.

Still required before Media P9A: link an explicitly approved editor’s exact Entra (issuer, subject) to the internal user and active Media membership (never email auto-link); exercise real discovery/JWKS/token exchange, callback/session, protected editor actions and logout; accept public Media/editor workflows on desktop/mobile; provision and validate remaining Media access, broadcast, token-issuer and social-dispatch runtime identities/bindings only where required by the approved feature scope; verify Logic Apps adapter/identity/cost/idempotency/monitoring/reconciliation while keeping its workflow disabled; complete V2-target backup/PITR recovery rehearsal; then prove route isolation, rollback and explicit P9A go/no-go. No legacy database restore/import is planned or needed. Prediction remains a separate P9B release; Factsport TV remains deferred to P10.


### 2026-11-18 follow-up — Media login readiness regression corrected

The owner-provided screenshot showed the Media login page displaying “not provisioned” despite configured Entra secrets and the newly provisioned editorial Hyperdrive. Diagnosis: the readiness SQL incorrectly required `current_user` to equal the NOLOGIN capability role. The connection correctly uses the dedicated LOGIN role `factsport_v2_editorial_app`, which inherits `factsport_v2_editorial_writer`; the check now verifies that exact login and its `pg_has_role(..., 'USAGE')` capability membership, along with the scoped identity and membership read grants. The existing regression assertion was updated to enforce that contract.

The first workflow after the code change deployed successfully but hit a transient connection reset on the initial `/media-login` fetch; it did not validate that page. The staging smoke now retries that fetch and requires the actual “Continue with Microsoft” control when Entra settings are present. The corrected verification/deploy run [44367785398](https://github.com/MketyDigital/Factsport/actions/runs/44367785398) passed regression, TypeScript, native Worker build, deploy, the Media login readiness assertion, Entra discovery/issuer/callback/PKCE redirect, PostgreSQL/R2, and protected-route isolation. This verifies the configured staging login entry point is enabled; an interactive editor’s Entra callback, exact `(issuer, subject)` link, active membership and protected editorial actions still require owner/browser acceptance.


### 2026-11-18 owner preference — Factsport-branded identity journey

Owner preference is a Factsport-only customer-facing identity experience. Keep Entra External ID as the current managed identity backend for now; do not expose Microsoft naming in Factsport-owned UI. The Media login button now says “Sign in to Factsport” and staging asserts the Factsport label. Next tenant-side steps are to set the display name to Factsport, apply External ID company branding, configure a Factsport custom login domain, and grant tenant-wide admin consent to the minimum app permissions so customer users do not encounter the first-party Microsoft consent prompt. Microsoft’s consent surface cannot be reskinned; tenant-wide admin consent is the way to remove it from the routine customer journey. The default verification email can show the configured tenant name; a fully Factsport-branded OTP email requires the custom OTP send extension and a verified sender through an approved mail provider (assess the existing Mkety Mail/Logic Apps adapters before enabling). The `Continue with Microsoft` source regression assertion was updated to enforce Factsport-owned wording.
