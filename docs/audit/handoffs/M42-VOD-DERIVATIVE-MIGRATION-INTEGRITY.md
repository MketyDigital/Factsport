# M42 — Repair VOD and derivative migration integrity

Date: 2026-11-09
Branch: refactor/factsport-v2
Current recorded commit: b6d3d8810ad46cda7e8754438ddfcc5e0a67eff8
Status: source and regression corrections committed; latest isolated verification, native build and protected staging are still running/pending. No migration has been applied.

## Audit evidence and root causes

The VOD implementation introduced migration 0041 and a new `tests/media-video.test.cjs` contract. The first current verification at commit `995d6e164e3f10ffc7a0d30506d81755e3c1b5e7` failed the engine test command with 209 passing tests and one failure:

- Test 157, `Cloudflare Stream VOD is separate, signed, fail-closed and revision-scoped`, expected the migration to contain `requireSignedURLs`. The server adapter already sent `requireSignedURLs: true`, but the database schema did not persist a corresponding signed-playback invariant.

The first attempted repair then exposed further test defects and a migration integrity issue:

- Migration 0041 had been damaged by overlapping edits: duplicated SQL, three transaction endings, and incomplete/invalid constraint fragments.
- Test 157's assertion searched from the INSERT statement through the rest of the file for the string `uploadURL`, so it incorrectly failed when it encountered the upload URL variable before/after the metadata insert. The intended contract is that the upload URL itself is not among the persisted table columns.
- Test 182 expected one exact SQL whitespace format for `v.upload_status='ready'`, rather than checking the SQL expression independent of spacing.
- Migration 0039's PL/pgSQL trigger body used single-dollar delimiters (`AS $` / `$;`) instead of valid paired dollar quotes (`AS $$` / `$$;`).

## Corrections committed

- Rebuilt `db/migrations/0041_factsport_media_video_assets.sql` as one clean transaction with one BEGIN/COMMIT pair.
- Added `signed_playback_required boolean NOT NULL DEFAULT true CHECK (signed_playback_required = true)`; public views require it, and the direct-upload adapter continues to set Cloudflare's `requireSignedURLs: true`.
- Restored explicit provider UID, playback-host, duration, rights-reference, reviewer-pair, expiry, publication and least-privilege grant constraints.
- Repaired the PL/pgSQL function delimiter in migration 0039 and added a regression assertion for paired dollar quoting and transaction integrity.
- Corrected the direct-upload test to inspect only the actual INSERT column list, rather than matching across unrelated code.
- Made the public video projection test whitespace-tolerant.
- Extended the contiguous migration inventory regression from 0001–0037 to 0001–0041.

Relevant commits:
- `475ac5f3f2055088bc2790f4dc7b487401175511` — rebuild VOD migration and signed playback invariant.
- `f22a549f1f20c6b65fb5628f6138053a53fe3425` — align signed-playback regression assertion.
- `0ef2d4d76d4f5289f756e610c3c0f85e6e0343b0` — repair derivative trigger SQL quoting.
- `3ab976f1ed993926d3668308efd20956f99b9d9a` — guard derivative migration transaction integrity.
- `9a8a2689f742587f85896fe96702d49030917270` — scope direct-upload persistence assertion.
- `b85500d775dee1e08623849d766a4b337ac11818` — make public projection assertion whitespace-tolerant.
- `c81a1113eb42cbb21699cd0da151f878bb48a124` — correct VOD upload assertion and assert migration transaction integrity.
- `b6d3d8810ad46cda7e8754438ddfcc5e0a67eff8` — extend migration inventory through 0041.

## Verification status

- At the time of this handoff, the isolated verification and native build triggered by `c81a111` were still running; the protected staging run was cancelled by a newer push.
- New isolated verification, native build and protected staging workflows were triggered for `b6d3d88`; they had not yet completed at handoff time.
- Earlier failed run evidence is diagnostic only; no pass is claimed for the corrected code until the current head's checks finish.
- Migration 0039 and 0041 are still source-only and unapplied. Protected staging currently does not apply them. No production schema, R2 object, Stream asset, provider credential, public post or production deployment was changed.

## Remaining acceptance

1. Confirm current head `b6d3d88` isolated tests and native build pass; fix any newly exposed failures.
2. Parse/apply migrations 0039–0041 in a disposable isolated PostgreSQL database with the preceding 0001–0038 chain, then test grants, views, rights withdrawal and signed-playback enforcement. Do not apply in production.
3. Add a dedicated least-privilege server role/binding for the private Stream UID token lookup; the public article DTO must never expose provider video IDs or signing tokens.
4. Test direct upload, processing refresh, expired unuploaded cleanup, private editorial preview, rights review/revocation, publication, public signed playback and revision restore end to end in staging.
5. Keep all Stream upload/playback flags disabled until staging secrets, signing JWK, allowed origins, applied schema and private-domain browser tests are verified.

## Safety

No production migrations, Cloudflare Stream settings, R2 objects, secrets, DNS, public articles or live workflows were changed.
