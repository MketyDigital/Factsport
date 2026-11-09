# M41 — CI coverage for Media admin, dispatcher and orchestration changes

Date: 2026-11-09
Branch: refactor/factsport-v2
Baseline: e1111c574f0f5f1c7d67b041a365a9a8cdd8d0df
Current commit after this handoff: c3ac3a693fcad8e5c70eb4dd19146198d5280b2a
Status: workflow change committed; isolated verification is running.

## Scope

Close a CI trigger-coverage gap found while auditing M38–M40 and the current verification workflow. The isolated verification workflow previously did not trigger for every change under the Media admin workspace, admin/internal APIs, Azure Logic Apps templates, or audit/implementation documentation unless another already-watched path also changed.

## Source inspected

- .github/workflows/v2-verify.yml
- .github/workflows/v2-app-staging.yml
- .github/workflows/v2-cloudflare-staging.yml
- docs/audit/ROADMAP.md
- docs/audit/handoffs/M38-SOCIAL-DISPATCH-CLAIM-AND-RECEIPT-API.md
- docs/audit/handoffs/M39-EDITORIAL-SOURCE-PROVENANCE-AND-SOCIAL-CHANNEL-ADMIN.md
- docs/audit/handoffs/M40-SOCIAL-PROVIDER-ADAPTERS-AND-LOGIC-APPS-ORCHESTRATION.md

## Change committed

Updated .github/workflows/v2-verify.yml to include these push path filters:

- app/admin/**
- app/api/admin/**
- app/api/internal/**
- infra/azure/**
- docs/audit/**
- docs/implementation/**

Commit: c3ac3a693fcad8e5c70eb4dd19146198d5280b2a

## Validation

- Re-fetched the workflow from the branch and verified all six filters are present.
- Isolated verification run 42562199473 was created for commit c3ac3a693fcad8e5c70eb4dd19146198d5280b2a and was in progress at handoff time.
- No test/build pass is claimed for this commit until that run completes.
- No database migration, deployment, provider credential, social channel, production setting or public post was changed.

## Findings retained as open

- M38–M40 provider dispatcher remains source-only until dedicated dispatcher role/Hyperdrive, migrations 0032 and 0036–0038, secure provider secrets and private provider E2E are verified in isolated staging.
- The Logic Apps workflow template remains disabled. Buffer/Make require the secured APIM/Logic Apps adapter and provider receipt validation.
- Operator reconciliation UI for unknown_result/dead-letter posts, provider receipt inspection and controlled replay remains unimplemented.
- Media newsroom, R2 upload/preview, rights review, revision provenance and broadcast Studio require real isolated-database/R2/Stream runtime tests; protected app staging currently proves the existing PostgreSQL reader path, not these workflows.
- AdSense readiness remains a separate live-domain/legal/consent/ads.txt/account gate; no approval or live ad serving is claimed.
- Prediction system parity, SQL settlement verification, identity migration and production cutover remain separate roadmap gates.

## Next exact actions

1. Wait for run 42562199473; resolve any failure before further source changes.
2. Complete the operator reconciliation UI with strict Media RBAC, append-only audit events, no blind retry for unknown_result, and explicit external-provider verification before controlled replay.
3. Run the full isolated PostgreSQL migration/grant chain and negative permission tests through migration 0038; do not apply to production.
4. Provision staging-only dispatcher and editorial identities/Hyperdrives, Entra identity, R2 and Stream bindings, then run the full CMS/social/broadcast journeys.
5. Continue the legacy-v2 parity audit for sports, match centre, prediction settlement, account/VIP/campaign ownership and the old SQL definitions.

## Rollback

Revert commit c3ac3a693fcad8e5c70eb4dd19146198d5280b2a if the expanded workflow trigger scope causes an operational issue. No runtime application behavior or deployed resource is affected.
