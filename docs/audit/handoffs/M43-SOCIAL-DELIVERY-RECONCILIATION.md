# M43 — Social unknown-result and dead-letter reconciliation

Date: 2026-11-09
Branch: refactor/factsport-v2
Source checkpoint: 28f87f2969a4e5793889b366e396972835ff6fa5
Status: source implementation and disposable migration apply verified; protected application staging workflow is still running. Azure staging migration and reconciliation activation remain disabled.

## Implemented

- Migration 0042 adds a private `media_social_operator_reconciliation` view. It returns only dead-letter `unknown_result` publications and exposes sanitized provider receipt summaries, request IDs, error fields and attempt metadata.
- The view is granted only to `factsport_v2_editorial_writer`; it is revoked from PUBLIC, the public reader, schedule/ESPN writers and the dispatcher. The editor role does not receive direct SELECT on the delivery-attempt table.
- Migration 0042 registers append-only audit actions:
  - `social_delivery_reconciled_published`
  - `social_delivery_requeued_after_no_post`
- The admin Social page loads the reconciliation view only when `FACTSPORT_SOCIAL_RECONCILIATION_READY=true`. The server action checks the same flag and fails closed otherwise.
- The UI displays the provider request ID, attempt count, outcome, sanitized response and error information. It requires an explicit operator confirmation and evidence note.
- `confirmed_published` requires a provider post ID and canonical HTTPS URL. The transaction locks the publication/outbox rows, checks the current unknown-result receipt, updates the publication/outbox to completed and records an audit event. The original attempt remains `unknown_result` for audit integrity.
- `confirmed_not_published` requires no stored provider post ID/URL, a positive operator confirmation and evidence. It requeues only while attempts remain below the existing six-attempt limit. The requeue is audited.
- The server action never calls a provider. It does not mutate the original delivery-attempt row and cannot requeue a delivery with an existing provider post ID or URL.

## Verification

- Migration 0042 was applied with migrations 0001–0041 in the disposable PostgreSQL 16 workflow. The view, role grants, restricted reader/dispatcher access and audit constraint were checked. Run [42572684152](https://github.com/MketyDigital/Factsport/actions/runs/42572684152) passed.
- Isolated verification passed on source commit `28f87f2969a4e5793889b366e396972835ff6fa5`, run [42572757675](https://github.com/MketyDigital/Factsport/actions/runs/42572757675).
- The 210+ engine regression suite, TypeScript and migration contract checks passed on that commit.
- Native Vinext build passed on commit `28f87f2969a4e5793889b366e396972835ff6fa5`, run [42572757657](https://github.com/MketyDigital/Factsport/actions/runs/42572757657).
- Protected application staging run [42572757656](https://github.com/MketyDigital/Factsport/actions/runs/42572757656) was still building at the time of this handoff; no pass is claimed for that run yet.

## Activation controls

- `FACTSPORT_SOCIAL_RECONCILIATION_READY` must remain unset until migration 0042 is applied to the owner-approved isolated Azure staging database and the editorial-writer view permission is verified there.
- Do not set the flag in production.
- Live dispatcher/provider readiness flags remain separately controlled. Reconciliation does not activate provider dispatch.
- No provider token, Page token, bot token, Logic Apps/APIM bearer secret or webhook URL is stored in the reconciliation view or audit details.
- No social account was activated and no post was published by this implementation.

## Remaining acceptance

1. Complete the protected application staging workflow for the current source.
2. Apply migration 0042 only to owner-approved isolated Azure staging after backup/restore review; inspect the existing dead-letter queue before activation.
3. Set `FACTSPORT_SOCIAL_RECONCILIATION_READY=true` in staging only after verifying the editorial role grant and private view access.
4. Test both decisions with private test destinations: provider accepted but callback lost; provider did not accept and operator verifies absence; stale/repeated operator requests; existing provider post ID; attempt limit reached; concurrent reconciliation; audit immutability.
5. Keep provider dispatch disabled until the independent Meta/Telegram/Buffer/Make private E2E and Logic Apps/APIM acceptance gates pass.

## Safety

No Azure or production migration was applied. No staging or production flag was enabled. No provider credentials, public social posts, DNS, Worker routes, R2 objects or Cloudflare Stream assets were changed.


## Protected staging follow-up — 2026-11-09

- Protected Cloudflare application staging completed successfully on source commit `28f87f2969a4e5793889b366e396972835ff6fa5`, run [42572757656](https://github.com/MketyDigital/Factsport/actions/runs/42572757656).
- The run passed the regression suite, TypeScript, native Cloudflare Worker build, isolated Worker deployment, deny-by-default probes and protected /matches health checks.
- Scope limitation: this staging workflow does not apply migrations 0042 to Azure PostgreSQL and does not enable `FACTSPORT_SOCIAL_RECONCILIATION_READY`. It does not exercise real provider reconciliation or post publication.
- Migration 0042 remains unapplied to Azure staging and production; all activation controls remain disabled.
