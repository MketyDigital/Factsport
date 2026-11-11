# M66 — Full draft-snapshot concurrency token for external video

Date: 2026-11-11
Branch: `refactor/factsport-v2`
Status: V2 source and regression assertions committed; full Node/TypeScript/Vinext/connected database/staging execution unverified.

## Finding

M64 created one database transaction for approved YouTube/Vimeo source metadata, a private rights reference, an iframe in draft Markdown, and an audit event. M65 prevented stale revision IDs and detected changed bodies. A second editor could still modify **non-body** snapshot fields in the same draft revision, and an old browser tab with the same revision ID/body could not detect it. The client unsaved-field guard only detected local edits relative to its loaded data.

## Implementation

1. In `app/admin/news/page.tsx`, the existing editorial query now projects `CASE WHEN r.workflow_status='draft' THEN md5(r.snapshot::text) ELSE NULL END AS current_revision_snapshot_etag`. This uses PostgreSQL's built-in MD5 to create an **optimistic concurrency token**, not an authentication or cryptographic security guarantee. No new table or migration is needed.
2. In `NewsroomClient.tsx`, the currently selected article's draft snapshot token is required to enable atomic video attachment and is sent as `expectedSnapshotEtag` together with `expectedRevisionId` and `expectedBody`.
3. In `app/admin/news/actions.ts`, `attachExternalVideoToDraft` validates the 32-character hex ETag, then selects `md5(snapshot::text) AS snapshot_etag` within the existing transaction and `FOR UPDATE` draft revision lock. It rejects a mismatched saved snapshot token before any source insert, snapshot update or audit mutation.
4. Existing revision ID and body equality checks remain as defense in depth. The server continues to derive allowlisted YouTube/Vimeo URLs itself, records source attribution/private rights metadata and does not permit paid Cloudflare Stream VOD.
5. Regression assertions in `tests/media-legacy-source-security.test.cjs` protect the projection, client wiring and locked server-side snapshot validation.

Commits:
- `644580fbcac1161d3ba3563bd439e4d7bd62444a` — snapshot token projection
- `9f072b9c5b0a50dd7b7158ce84bdd7fc8e969df5` — locked server snapshot check
- `14a0e4a866eb66b9c0ef5815fff97ac94960fb3f` — client ETag requirement
- `d6146049929e0f75ab4ab144f01eb5503d46f931` — regression assertions

## Verification

Re-fetched the four changed files on the V2 branch through the GitHub connector. Source inspection verified that the page computes the token from the active draft snapshot, the client requires/sends it, and the server computes and compares the token **after acquiring the draft lock**. Corresponding source assertions exist.

**Not verified:** executing the repository Node suite, TypeScript check, Vinext build, real PostgreSQL transaction/row locks, Cloudflare protected staging or real two-browser race tests. Do not treat source inspection as CI passing.

## Remaining caveats and release gates

- ETag protects fields stored in the **revision snapshot**, not separate tables such as attached R2 media and source records; those require their own consistency policies and approval checks. It is not a full editor-wide revision integrity token.
- The currently editable draft snapshot is updated in place by the attachment action, while save operations create new editorial revisions. Test that the editorial revision history, reviewer separation and publication gates still behave correctly.
- PostgreSQL MD5 here is a change-detection ETag and must never authorize access; authentication/authorization stays in the existing media editorial action.
- Run `npm run test:engine`, `npm run typecheck`, `npm run build:vinext` and protected Cloudflare staging. Exercise two-editor cases: same body/new revision, same revision/non-body snapshot changed, valid no-change transaction, rights denial and transaction rollback.
- Continue historical video-provider inventory, Stream.io live studio, fast live worker, social rewrite automation, separate Prediction parity and the complete cutover roadmap. Factsport.com Media and AdSense safety remain the primary scope.
- Owner rejected separately billable Cloudflare Stream hosted VOD: its source-level restriction remains in place. No production DNS, database, infrastructure, ads, provider or billing change is authorized.

No production changes were performed.
