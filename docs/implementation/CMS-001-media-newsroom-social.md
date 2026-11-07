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
5. Apply migrations 0009–0011 in order, after migrations 0004–0005 and after role creation; run schema and grant audits.
6. Add the verified Hyperdrive ID as `FACTSPORT_EDITORIAL_HYPERDRIVE` in the native Cloudflare app config and deploy only to staging.
7. Complete the V2 authentication/domain-identity bridge and provision explicit administrator mappings before enabling review/publish actions.

The CMS intentionally fails closed while this binding is absent. It does not fall back to `getSupabaseAdmin`, `DATABASE_URL`, the public reader, the schedule writer, the ESPN writer or the legacy `news` table.

## Social delivery boundary — not yet connected to providers

The Social Publishing screen creates scheduled publications and outbox rows. It does **not** send posts to Buffer, Meta, Telegram or another provider yet. No social credentials are stored in PostgreSQL or added to source. A separate dispatcher identity/Worker, provider adapters, secret bindings, channel setup, claim/lease/retry implementation, provider idempotency and delivery verification are still required.

The existing match-event social automation route and its event safety map are not replaced by the editorial outbox. They must be audited and migrated separately while preserving current channel routing, copy templates, event de-duplication, media generation, fallbacks and provider retry behaviour. Do not enable duplicate posting paths during cutover.

## Remaining CMS capabilities

- Rights-aware asset upload, R2 metadata creation, attribution/source capture, expiration and editorial media picker.
- Preview rendering that matches the public article renderer, scheduled article publication, revision diff/restore, approval comments and review rejection/change requests.
- Editorial role matrix (writer, editor, publisher, media admin), audit events and stronger review separation than a single admin flag.
- Social calendar, per-channel copy variants, media attachments, approval, edit/reschedule, retry/dead-letter UI, delivery receipts and analytics.
- Dedicated dispatcher Worker with durable queue claiming, expired-lease recovery, bounded retries/backoff, provider-specific rate limits and delivery-attempt persistence.
- Safe migration/mapping of legacy news rows and social settings only after field-level transformation/parity inventory. No bulk import or deletion is performed by these commits.

## Validation status

Source-level tests were added. A successful local typecheck, full test run, Cloudflare build, migration application, database grant audit and staging UI test have **not** yet been recorded for this slice. Passing repository commits are not proof of runtime readiness.
