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
- Archived the prior Supabase-backed match-event sender verbatim and replaced the active V2 `/api/social` route with an explicit 410 fail-closed response. See M21 for the preserved behavior contract.
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
5. Apply migrations 0009–0015 in order, after migrations 0004–0005. Create the role before applying 0010; apply 0013 after 0012; apply 0014 after 0013; apply 0015 after 0014. Run schema and grant audits.
6. Add the verified Hyperdrive ID as `FACTSPORT_EDITORIAL_HYPERDRIVE` in the native Cloudflare app config and deploy only to staging.
7. Complete the V2 authentication/domain-identity bridge and provision explicit administrator mappings before enabling review/publish actions.

The CMS intentionally fails closed while this binding is absent. It does not fall back to `getSupabaseAdmin`, `DATABASE_URL`, the public reader, the schedule writer, the ESPN writer or the legacy `news` table.

## Social delivery boundary — not yet connected to providers

The Social Publishing screen creates scheduled publications and outbox rows. It does **not** send posts to Buffer, Meta, Telegram or another provider yet. No social credentials are stored in PostgreSQL or added to source. A separate dispatcher identity/Worker, provider adapters, secret bindings, channel setup, claim/lease/retry implementation, provider idempotency and delivery verification are still required.

The existing match-event social automation route is archived and disabled in V2; its event safety map, VIP logic, event detection, templates, stream-aware copy, image disable preference, Buffer/Meta/Make/Telegram routing and retry fallbacks are recorded in M21. Migration 0015 seeds the routing defaults but does not activate them. A separate match-event event detector, durable event outbox and provider dispatcher still need implementation and staged parity verification. Do not enable duplicate posting paths during cutover.

## Remaining CMS capabilities

- Media preview and crop/resize tooling, inline article media ordering, asset replacement/versioning, and public-page preview parity. Revision-aware hero/team attachment and publish-only public visibility are implemented; full media-library search and visual asset replacement preview remain.
- Preview rendering that matches the public article renderer, scheduled article publication, revision diff/restore, approval comments and review rejection/change requests.
- Editorial role matrix (writer, editor, publisher, media admin), audit events and stronger review separation than a single admin flag.
- Social calendar, per-channel copy variants, media attachments, approval, edit/reschedule, retry/dead-letter UI, delivery receipts and analytics.
- Dedicated dispatcher Worker with durable queue claiming, expired-lease recovery, bounded retries/backoff, provider-specific rate limits and delivery-attempt persistence.
- Safe migration/mapping of legacy news rows and social settings only after field-level transformation/parity inventory. No bulk import or deletion is performed by these commits.

## Validation status

On commit `21d1e844748d47af06024160b810788df4101691`, the repository engine regression suite, isolated ingestion regression tests, TypeScript check and native Cloudflare build passed. The V2 staging Worker was deployed at `https://factsport-v2-staging.dry-glitter-7e16.workers.dev`; staging smoke tests confirmed deny-by-default access, authorized Hyperdrive/R2 health, PostgreSQL-backed `/matches` rendering, timestamp+UUID pagination and cache/auth isolation. The staging deployment is protected by a temporary access token; do not expose that token.

These checks validate the V2 app deployment and existing reader path, **not** the new editorial writer binding. The CMS admin route remains unavailable until its separate role/binding and administrator identity bridge are provisioned. Migrations 0009–0015 have not been applied; no database grant audit, CMS publishing UI test, R2 upload test or social-provider delivery test has been recorded. Passing build/deployment checks are not proof of CMS runtime readiness.
