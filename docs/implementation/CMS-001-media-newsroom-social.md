# CMS-001 — Media newsroom and social publishing implementation

Branch: `refactor/factsport-v2`

## Ownership

This slice belongs to the **Media system**. It does not add prediction campaigns, settlement, scoring, VIP or prize logic. Editorial publishing and social distribution are separate lifecycles; match-event social notifications remain a separate automation workflow.

## Implemented in source

- Replaced the browser-direct legacy `news` table screen with a V2 newsroom workspace.
- Added server actions for draft save, review submission, independent approval, publication and archive.
- Draft saves create immutable revision snapshots.
- A published article remains visible while a replacement revision is drafted and reviewed. The live article row is changed only when the pending revision is approved.
- Self-approval is blocked when the domain identity mapping identifies the author.
- Admin list reads pending draft/review revisions without substituting their contents into the public article view.
- Added editorial revision workflow metadata in migration 0011.
- Added social channel, publication, delivery-attempt and durable outbox tables in migration 0009.
- Added a separate Social Publishing admin workspace for channel-specific scheduled posts, linked only to already-published approved articles.
- Added an admin-only R2 image upload endpoint with JPEG/PNG/WebP signature validation, an 8 MB limit, SHA-256 metadata, private-by-default asset rows and cleanup on failed DB registration.
- Added a rights-review and revision-scoped attachment workflow for hero images and team logos. Rights approval does not make an image public: assets stay private while a draft/revision is pending, then the approved revision atomically promotes its selected assets with publication.
- Added migration 0014 to preserve revision-specific hero/team-logo choices and constrain the public media view to assets actually attached to approved, published articles.
- Added migration 0015 with the legacy match-event social route matrix, VIP teams/leagues, first-match fallback, UTC timezone default, text-only image policy and editable channel/template tables. Seeded channels and global automation remain disabled.
- Added a pure match-event detector and migration 0016 for canonical event identities, per-channel delivery leases and append-only attempt outcomes. Event detection is not yet wired to ingestion and the dispatcher is not active.
- Added migration 0017 and PostgreSQL read adapters for the legacy Media playback fields, live display clock, provider widget ID and public match pins. Raw playback URLs are isolated to a private server-side projection and remain subject to the 15-minute unlock and rights gate. See M24.
- Added migration 0018 and a Prediction-only affiliate settings view. The public Media /api/settings endpoint now returns only the homepage projection; Prediction affiliate settings are served by the separate private-host-only /api/prediction/settings endpoint. See M25 and M30.
- Added migration 0019 for the Global Goal Rush studio, match/global broadcast rooms, independent Media host/moderator/caller roles, hashed/revocable guest invites, participant state and append-only broadcast audit. Studio/rooms start inactive; token issuer and admin roles are not provisioned. See M26.
- Added migration 0020 for domain-owned Media editorial RBAC and append-only audit events. The newsroom now has separate writer, editor, publisher, social-manager and media-admin capabilities, with distinct author/reviewer/publisher identities. See M28.
- Added migration 0021 for review comments and rejection/change requests. Social scheduling now reuses a caller request UUID and verifies the complete payload on retry to prevent duplicate outbox records. See M29.
- Added migration 0022 to restrict Media social channels and publications to the public Media surface and require an operator attestation before public distribution. See M30.
- Added migrations 0023–0025, including a separate Media homepage announcement editor and scoped writer grants, and a CMS publisher gate that scans article text, SEO fields, tags and canonical URLs for bookmaker affiliate links, explicit betting promotions and private VIP/prize inducements. Publishing requires explicit public Media confirmation and records policy version, publisher identity and timestamp on the exact revision. See M30.
- Added migration 0024 to move public announcement copy/link/enabled fields into Media-owned homepage settings. The public settings endpoint and match player read only this V2 projection; Prediction affiliate settings remain on the private-only API. See M30.
- Archived the legacy `/admin/studio` Supabase writer and replaced its active V2 page/actions with a fail-closed readiness surface; it cannot read/write `global_studio` or issue legacy Stream tokens. See M27.
- Archived the prior Supabase-backed match-event sender verbatim and replaced the active V2 `/api/social` route with an explicit 410 fail-closed response. See M21 for the preserved behavior contract.
- Replaced the active mixed legacy admin shell with a Media-only RBAC workspace. Legacy Match Manager and User Directory are retired from Media; Prediction account/entitlement operations remain a separate implementation boundary. See M28.
- Archived and disabled the legacy Supabase-backed `/api/live`, `/api/sync-fd`, `/api/matchmaker`, `/api/settle`, `/api/cron/morning-post`, `/api/evening-roundup`, `/api/logos/sync`, `/api/matches/highlights/sync`, monthly reset/audit and legacy admin settings/users routes. See M23 for owner boundaries and replacement gates.
- Social scheduling is idempotent, uses an outbox record, and is distinct from article publication.
- Added migration 0010 with a dedicated editorial writer's minimum table/column grants. The role is explicitly denied match, prediction and other writer responsibilities.
- Added static regression coverage for workflow boundaries and database grants.

## Database and deployment boundary — not yet provisioned

The public V2 application binding remains read-only. The schedule writer and ESPN writer must not be reused for CMS writes. The new server adapter requires a separate binding named `FACTSPORT_EDITORIAL_HYPERDRIVE`, connected to a dedicated `factsport_v2_editorial_writer` role.

The Cloudflare binding ID and role credential have **not** been created or attached by this source change. The historical admin Hyperdrive reference in earlier setup notes is not assumed valid. Do not invent an ID or point this binding at a legacy Supabase project.

Provisioning sequence still required:
1. Verify the exact Factsport V2 database and the currently authorized admin connection through the established guarded bootstrap process.
2. Create the dedicated editorial role with no superuser, no role inheritance, no database creation, no replication, no bypass-RLS and a bounded connection limit.
3. Provision a separate Hyperdrive with TLS required, SQL caching disabled and a small origin connection cap.
4. Verify positive editorial privileges and negative permissions for matches, predictions, settlement, DELETE/TRUNCATE and private user tables.
5. Apply migrations 0009–0024 in order, after migrations 0004–0005. Create the editorial writer role before applying 0010; create the Media access admin role before applying 0020; apply 0013 after 0012; apply 0014 after 0013; apply 0015 after 0014; create the separate Media automation and social dispatcher roles before applying 0016. Run schema and grant audits.
6. Add the verified Hyperdrive ID as `FACTSPORT_EDITORIAL_HYPERDRIVE` in the native Cloudflare app config and deploy only to staging.
7. Complete the V2 authentication/domain-identity bridge and provision explicit administrator mappings before enabling review/publish actions.

The CMS intentionally fails closed while this binding is absent. Legacy Supabase side-effect routes are also disabled in V2; their source is archived and the replacement workflows remain separate implementation gates. It does not fall back to `getSupabaseAdmin`, `DATABASE_URL`, the public reader, the schedule writer, the ESPN writer or the legacy `news` table.

## Social delivery boundary — not yet connected to providers

The Social Publishing screen creates scheduled publications and outbox rows. It does **not** send posts to Buffer, Meta, Telegram or another provider yet. No social credentials are stored in PostgreSQL or added to source. A separate dispatcher identity/Worker, provider adapters, secret bindings, channel setup, claim/lease/retry implementation, provider idempotency and delivery verification are still required.

The existing match-event social automation route is archived and disabled in V2; its event safety map, VIP logic, event detection, templates, stream-aware copy, image disable preference, Buffer/Meta/Make/Telegram routing and retry fallbacks are recorded in M21. Migration 0015 seeds the routing defaults but does not activate them. The pure event detector and durable outbox schema now exist (M22), but they are not yet wired to canonical ingestion and no provider dispatcher exists. Staged event parity and delivery verification remain required. Do not enable duplicate posting paths during cutover.

## Remaining CMS capabilities

- Media preview and crop/resize tooling, inline article media ordering, asset replacement/versioning, and public-page preview parity. Revision-aware hero/team attachment and publish-only public visibility are implemented; full media-library search and visual asset replacement preview remain.
- Preview rendering that matches the public article renderer, scheduled article publication, revision diff/restore, approval comments and review rejection/change requests.
- Editorial role matrix (writer, editor, publisher, media admin), audit events and stronger review separation than a single admin flag.
- Social calendar, per-channel copy variants, media attachments, approval, edit/reschedule, retry/dead-letter UI, delivery receipts and analytics.
- Dedicated dispatcher Worker with durable queue claiming, expired-lease recovery, bounded retries/backoff, provider-specific rate limits and delivery-attempt persistence.
- Safe migration/mapping of legacy news rows and social settings only after field-level transformation/parity inventory. No bulk import or deletion is performed by these commits.

## Validation status

On commit `21d1e844748d47af06024160b810788df4101691`, the repository engine regression suite, isolated ingestion regression tests, TypeScript check and native Cloudflare build passed. The V2 staging Worker was deployed at `https://factsport-v2-staging.dry-glitter-7e16.workers.dev`; staging smoke tests confirmed deny-by-default access, authorized Hyperdrive/R2 health, PostgreSQL-backed `/matches` rendering, timestamp+UUID pagination and cache/auth isolation. The staging deployment is protected by a temporary access token; do not expose that token.

The later source validation on the social event work also passed the engine regression suite (including new social detector tests), TypeScript, PostgreSQL migration inventory and Cloudflare build. Its first staging deployment uploaded successfully, but the post-deploy authorized health probe returned HTTP 404 at the staging gate. The workflow was corrected to retry protected health probes and report sanitized diagnostics; the follow-up staging run on commit `c19d653c332b71c2470a8c90ead4dfa2d595f087` passed deployment, deny-by-default, authorized health, and PostgreSQL-backed reader checks. The later legacy-route isolation commit `00d300b644e40352d1e5c27a80a659ca503dc432` has passed the engine regression suite and is awaiting its own staging smoke run.

These checks validate the V2 app deployment and existing reader path, **not** the new editorial writer binding. The CMS admin route remains unavailable until its separate role/binding and administrator identity bridge are provisioned. Migrations 0009–0023 are committed but unapplied. No production roles, CMS writer binding, social dispatcher credentials or private Prediction host have been provisioned. Latest AdSense/public-content, social-scope and CMS policy changes are source-level only; the current CI workflows are being rerun after the final archive/test updates. No PostgreSQL integration test, CMS publishing UI runtime test, R2 upload test or social-provider delivery test has yet been recorded. Passing source tests or a build is not proof of CMS runtime readiness.
