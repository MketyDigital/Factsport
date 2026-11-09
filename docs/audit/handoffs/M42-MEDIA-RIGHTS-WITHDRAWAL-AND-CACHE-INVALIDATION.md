# M42 — Media rights withdrawal and public cache invalidation

Date: 2026-11-09
Branch: refactor/factsport-v2
Status: source implementation committed; CI verification running; migration 0040 unapplied; no live rights-revocation scenario has been executed.

## Implemented

- Added the rights_admin authorization capability, restricted to the Factsport media_admin role.
- Added revokeMediaRights in app/admin/news/media-actions.ts. It validates the asset ID and requires a reason of at least ten characters.
- The action locks the image asset, records affected article slugs including direct attachments and derivative descendants, then changes the asset to rights_status='rejected' and is_public=false. It records the reviewer identity/time and an append-only media_rights_revoked audit event.
- The original R2 object is retained. No object or database row is deleted; historical evidence and revision references remain.
- Public article, team-media, inline-gallery, general-media and social-media views stop returning the revoked asset. Derivatives are also suppressed when their original source is revoked or expired.
- Revalidates /news, the homepage and each affected public article route after the transaction.
- Added Media Library controls visible only to media_admin users. The operator must enter a reason; the UI explicitly warns that a post already published on a third-party social network must be removed separately at that provider.
- Reduced public media shared-cache TTL to 15 seconds while requiring browser revalidation (max-age=0), bounding stale public media exposure after a rights withdrawal.

## Database and tests

- Migration 0040 adds media_rights_revoked to the allowed editorial audit actions. The column-level media_assets UPDATE grants from migration 0038 already cover the fields changed by this action.
- Added regression coverage for role gating, retained R2 objects, audit reason, public route revalidation and the shortened cache TTL.
- CI migration inventory includes migrations 0001–0040.

## Activation and safety

- Migration 0040 is committed but unapplied. No production database, R2 bucket, provider account, external post, Cloudflare cache purge or live deployment was changed.
- The 15-second shared-cache TTL is a bounded propagation window, not instant cache purge. Already downloaded/cached copies and external social posts cannot be recalled by this database action.
- Staging must test direct asset withdrawal, source withdrawal with derivatives, article route revalidation, public image 404, social claim suppression and a previously published social post warning.

## Remaining Media work

1. Complete latest isolated regression, native Worker build and protected staging checks.
2. Exercise rights withdrawal against staging PostgreSQL/R2 and verify effective UPDATE privileges.
3. Add rights usage/reference discovery so the Media admin can see every article and scheduled social post that references an asset before withdrawing it.
4. Add controlled operator reconciliation for external social posts affected by a rights withdrawal.
5. Continue the separate video/clip ingestion and transformation workflow, full-page preview parity, and scheduled editorial publication.
