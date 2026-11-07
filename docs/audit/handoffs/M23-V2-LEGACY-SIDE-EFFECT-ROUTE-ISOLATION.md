# M23 — V2 legacy side-effect route isolation

Date: 2026-11-07
Branch: `refactor/factsport-v2`
Status: selected legacy Supabase side-effect routes archived and disabled; V2 replacements remain staged work.

## Why this change

The V2 branch still contained active legacy API handlers that created Supabase service-role clients and wrote to the legacy database. Keeping them active would risk running old writers after a future domain cutover, mixing Media and Prediction responsibilities, or sending duplicate social posts. The original handlers are preserved verbatim for parity work; the V2 route paths now fail closed with HTTP 410.

## Routes archived and disabled

| V2 route | Owner | Legacy behavior preserved in archive | Replacement status |
|---|---|---|---|
| `/api/live` | Media | ESPN scoreboard/detail refresh, Supabase match snapshots, social trigger attempt | Fast frontend live proxy and durable Media ingestion not yet wired |
| `/api/sync-fd` | Media | football-data.org fixture/competition sync and final-score reconciliation | V2 ingestion writer not yet wired |
| `/api/matchmaker` | Media | ESPN identity matching/alias updates | V2 verified match identity writer not yet wired |
| `/api/settle` | Prediction | legacy finished-match settlement | V2 atomic Prediction settlement not yet wired |
| `/api/social` | Media | event extraction, VIP selection, templates, Buffer/Meta/Make/Telegram fan-out | M21/M22 policy and outbox exist; provider dispatcher not yet wired |
| `/api/cron/morning-post` | Shared legacy route | daily preview/social work plus campaign expiry/unlink mutation | Must split Media publishing from Prediction campaign lifecycle |
| `/api/evening-roundup` | Media | daily summary/news generation and legacy social side effects | V2 editorial automation not yet wired |
| `/api/logos/sync` | Media | legacy Supabase team-logo metadata/storage update | V2 rights-cleared R2 asset workflow not yet wired |
| `/api/matches/highlights/sync` | Media | legacy match highlight discovery/storage writes | V2 highlights ingest and rights-aware media flow not yet wired |
| `/api/admin/reset-monthly` | Prediction | legacy monthly scoring counter reset | V2 scoring reset and audit workflow not yet wired |
| `/api/admin/run-audit` | Prediction | legacy prize/winner audit | V2 prize audit workflow not yet wired |
| `/api/admin/settings` | Shared | legacy global settings/social/payment config writes | Split Media settings from Prediction settings; secrets move to secret store |
| `/api/admin/users` | Platform identity / Prediction admin | legacy profile/admin user management | V2 identity and role administration not yet wired |

Each original source is under `docs/audit/legacy-source/`. Active route handlers use the shared `app/lib/v2/legacy-route-disabled.ts` guard (the social route has its dedicated dispatcher-not-provisioned response). They do not instantiate Supabase clients, read legacy service-role secrets, mutate legacy tables or call providers.

## Ownership corrections retained

- Media: live data, fixture ingestion, ESPN matching, public match metadata, logos/highlights, editorial automation, social distribution.
- Prediction: settlement, monthly scoring reset, prize/winner audit and campaign lifecycle.
- Shared legacy morning-post route must be decomposed; campaign expiry/unlink must not remain hidden inside Media social publishing.
- Global legacy settings are not copied as one mixed JSON object. Public preferences/templates are mapped into Media configuration; affiliate/payment/prediction settings remain in Prediction; credentials become isolated Cloudflare secrets.
- The separate fast frontend Worker and the cron-driven database sync remain distinct live paths (M20/WORKERS-001). Disabling `/api/live` does not replace the fast frontend Worker.

## Safety and cutover rules

1. The disabled V2 paths return 410, no-store. They are not aliases to legacy production routes.
2. Do not point V2 cron jobs, GitHub Actions, external workers or DNS at these disabled paths.
3. Build and test each V2 replacement against the archived source and DB audit notes before activation.
4. Do not run Media writers with Prediction settlement privileges or vice versa.
5. No production Supabase rows, Cloudflare routes, DNS, social credentials or scheduled triggers were changed by this isolation work.
6. V2 staging remains protected by its staging token. A successful code build is not a replacement for provider parity, database grant audit or runtime smoke tests.

## Validation

A new regression contract verifies each archived source exists and active route handlers contain no Supabase service-role client path. The tests must pass in CI before this isolation is considered complete. The routes are intentionally unavailable until their V2 owners are implemented and explicitly enabled.
