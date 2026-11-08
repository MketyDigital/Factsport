# M31 — Media asset library, private previews and publisher attestation

Date: 2026-11-08
Branch: `refactor/factsport-v2`
Status: source implementation committed; CI regression, native build and protected staging deployment passed; no editorial database migration or runtime asset upload verified.

## Scope and evidence

- `app/lib/admin/v2-editorial-authorization.ts`: authorization now requires the verified session JWT issuer and subject together and cross-checks token subject against the user returned by the authenticated session. The lookup uses the unique `(issuer, subject)` identity key.
- `app/api/admin/media/route.ts`: existing POST upload remains private, bounded to JPEG/PNG/WebP and 8 MB, signature checked and SHA-256 recorded. Added role-protected GET with bounded search/status filters and 50-row pagination.
- `app/api/admin/media/[id]/route.ts`: new authenticated private R2 preview endpoint. It reads metadata through `FACTSPORT_EDITORIAL_HYPERDRIVE`, serves only raster MIME types, and sends private/no-store, nosniff, sandbox and no-referrer headers.
- `app/admin/media/page.tsx` and `MediaLibraryClient.tsx`: new Media-role-protected searchable library with rights status, attribution, expiry, dimensions/size metadata and private previews.
- `app/admin/news/NewsroomClient.tsx`: newly uploaded assets can be previewed privately before rights approval and attachment.
- `app/admin/layout.tsx` and `app/admin/page.tsx`: Media library added to navigation and Media operations home.
- `db/migrations/0026_factsport_public_media_attestation_enforcement.sql`: validates public social delivery attestations and adds/validates a database check requiring policy attestation on published revisions. It aborts with an actionable error if legacy rows need reconciliation; it never silently attests or rewrites rows.
- Regression coverage extended in `tests/media-editorial-rbac.test.cjs` and `tests/editorial-cms-workflow.test.cjs`.

## Validation

- Isolated verification passed on code commit `5a6f4a86e27b7d27c20eb2c73d21b3a3534d6957` (workflow run `42461455150`).
- Native vinext build passed on the same code commit (workflow run `42461455356`).
- Protected staging deployment passed on workflow run `42461455140`. The run verified regression suite, TypeScript, native Worker build, staging deployment and deny-by-default gate. It did **not** apply editorial migrations, exercise `/admin/media`, test the editorial Hyperdrive, or perform an R2 upload. It is a staging deployment only, not production.
- No migrations were applied, no Media roles/memberships or editorial Hyperdrive were provisioned, and no R2 asset upload was runtime-tested.

## Blocking gaps found during continuation audit

1. `middleware.ts` still applies a legacy email allowlist to `/admin`, despite M28's Factsport-owned RBAC decision. This can block valid newly assigned Media roles and is not the source of truth for authorization.
2. `app/admin/layout.tsx` redirects unauthenticated users to `/login`, but `app/login/layout.tsx` is private-Prediction-host-gated. Media editors therefore do not yet have a verified Media-host login journey.
3. The current Media authorization adapter still consumes a Supabase server session. Entra External ID is the owner-confirmed Day 1 identity adapter, but its tenant/app registration, OIDC callback, PKCE, JWT/JWKS validation and session adapter are not configured or runtime-proven.
4. The dedicated editorial Hyperdrive, Media access-admin/editorial-writer roles and memberships are not provisioned. Migrations 0004–0026 remain unapplied.
5. Asset-library UI supports browsing and private preview, but asset replacement/versioning, crop/resize, inline ordering, scheduled editorial publication, revision diff/restore and public-renderer preview parity remain.
6. Social scheduling remains an outbox workflow only. No provider dispatcher, credentials, delivery reconciliation or provider E2E is active.
7. AdSense remains disabled; CMP, account approval and live `ads.txt` verification are external gates.

## Next actions

1. Implement Entra External ID adapter and Media-host editor login/session flow before removing the legacy middleware guard. Then remove the email allowlist and rely on server-side Media RBAC at layouts/actions/routes.
2. Provision and independently verify the editorial writer and media access-admin roles/Hyperdrive; apply migrations 0004–0026 in dependency order to isolated staging only.
3. Run actual PostgreSQL migration/constraint/grant tests and two-editor/third-publisher E2E.
4. Add existing-asset selection/replacement, crop/resize/inline ordering and revision-aware previews.
5. Build a durable social dispatcher with separate provider secrets, idempotent claims, retries, dead-letter and unknown-result reconciliation; do not enable credentials until tests pass.
6. Continue full Media page/component parity and AdSense policy review; no production cutover without explicit approval.

## Safety

No production database, legacy Supabase rows, DNS, Cloudflare production routes, social provider credentials, AdSense account, publisher ID or CMP was changed. No article or media rows were imported.


## Follow-up M32 identity integration

The Media admin now has a source-level Entra External ID OIDC/PKCE flow and encrypted Factsport session. The Media authorization bridge and admin layout consume this session, while middleware bypasses the old Supabase/email allowlist only on cookie presence; all actual Media authorization remains server-side and rechecks the issuer+subject+internal UUID mapping plus active Factsport Media membership. See `M32-ENTRA-MEDIA-EDITOR-IDENTITY-FLOW.md` for security properties and the exact external configuration still required. Real Entra sign-in is not yet verified; tenant/app registration, deployed callback hostname, Cloudflare session secret, editorial Hyperdrive and role memberships remain prerequisites.


## CMS preview parity addition

The newsroom composer now has a draft article preview using the exact public `MarkdownRenderer` component (including its sanitization and safe-embed pipeline). This avoids a second renderer drifting from public output. It is a source/build-verified UI preview; article media placements and final page-layout preview still need to be loaded from the revision-scoped media join before the full public article preview is considered complete.
