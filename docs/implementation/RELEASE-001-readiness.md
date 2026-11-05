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
