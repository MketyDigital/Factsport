# 2026-11-25 acceptance checkpoint — M106

Inspected branch HEAD ef4b475aed60b5b62e0b6d8ae41c51f25021fb97. Issue #288, governing contract, roadmap, execution plan, five migration matrices and TV-001 reviewed. Matrix historical notes (unapplied migrations, unconfigured Entra) are not current evidence; retain them as history, reconcile against scoped later runs.

## New evidence
- Exact HEAD isolated verification: https://github.com/MketyDigital/Factsport/actions/runs/45403401998 success. HEAD changes three planning documents, not runtime.
- Large-model intake source caf66e2d60ee98acdd655abb1c81811631ecec04: isolated verification 45384439136, disposable migration 45384439058, native build 45384439141, protected staging 45384438535, guarded migration 45384438723 all successful (https://github.com/MketyDigital/Factsport/actions/runs/). Guarded migration job includes target verification, forward migration/checksum step and temporary Worker deletion. Migration 0054 workflow passed; exact ledger count not independently read from logs.
- 512 MiB resumable private GLB intake, 16 MiB parts, owner-bound sessions, ordered part-manifest digest (not whole-file digest), rights pending. Actual 300–400 MB model upload/resume, authorization and review remain untested. M106 defines A data-only, B licensed highlight-assisted, C tracking-based reconstruction; B/C runtime not implemented by planning commit.

## Acceptance reconciliation
- Public pages/APIs, sports ESPN-first/conditional FD, standings/match centre: prior scoped staging evidence only; complete route/component parity, provider failure/recovery and full match lifecycle OPEN.
- Editorial/CMS/authored assets, Media RBAC, account/auth/admin: scoped protocol and preflight evidence only; signed-in editor/reviewer/publisher and negative permissions, provenance, stable slugs and rollback OPEN.
- TV: model intake source/build/migration/preflight verified; actual upload/resume, cross-user denial, malformed GLB, abort/cleanup, independent rights review, 3–5 minute render, audio/captions/QC, private storage and social receipts OPEN. Mode B licensed source ingest/alignment and C calibration/tracking benchmarks OPEN. No original broadcast footage or audio publication authorized.
- Predict/campaign/VIP/payment/points/settlement/monthly audit: OPEN; preserve existing free host; identity/paid/legal/prize disposition requires owner review.
- Chat/MOTM/pins/video/PWA: OPEN for full runtime journeys, Stream integration and moderation.
- AI/Mail/social/indexing/schedules/retention/jobs: OPEN for real provider and scheduler evidence, retries and idempotency.
- DB/security/backup/rollback/load/accessibility/SEO: migration evidence scoped; restore, privilege/runtime coverage, responsive brand-preserving visual tests, legal/navigation/disclosures, ads.txt, robots/sitemap, CWV OPEN.
- AdSense BLOCKED: account/site Ready and Policy Center status not accessible; owner confirmation and legal decisions needed. Google restrictions https://support.google.com/adsense/answer/10437795 and policy distinction https://support.google.com/adsense/answer/10008391 reviewed; Nigeria is not among gambling restriction geographic exclusions. October 2026 video inventory update https://support.google.com/publisherpolicies/answer/10852414 also relevant if video ads later considered. No ad code activation.
- Clean reset unchanged: no legacy destruction, preserve reviewed identity/financial/legal/authored assets. Production go/no-go OPEN.

## Next exact actions
1. On isolated staging, use two authorized editor/admin identities and synthetic self-contained GLB to exercise multipart start, interrupt/resume, cross-user denial, duplicate part, complete, private retrieval, pending rights and independent review; verify abort/cleanup and audit. Then intake owner stadium with source/license evidence. Do not treat source CI as this test.
2. Complete signed-in newsroom publishing/rollback and full ESPN-linked match lifecycle; rehearse isolated DB restore.
3. Build Mode A golden episode and Mode B manual-first licensed pilot under common versioned contract; Mode C remains quality-gated. No rights bypass.
No behavioral patch justified without authenticated runtime evidence; no tests newly executed by this checkpoint. No production changes, merge or cutover.