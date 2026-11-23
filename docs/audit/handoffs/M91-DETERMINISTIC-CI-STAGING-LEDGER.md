# M91 — 2026-11-23 deterministic CI, staging role hardening, and ledger verification

## Scope and current head

Audited the current V2 handoff, roadmap, production execution plan, acceptance contract, route/page/component/data/role matrices, and issue #288 before continuing. Current branch: `refactor/factsport-v2`, head `d12f690adcb5acc841841b1a83ead6e567550e14`. The work stayed on the V2 branch and Cloudflare staging.

## Completed

- Added and committed `package-lock.json`, stopped ignoring it, and changed all 16 `v2-*.yml` workflows from `npm install` to `npm ci`. Legacy workflows were left unchanged. Change commit: `d9e04821bf88b9836309f302d197d30df12b7709`.
- Clean local validation passed with Node 22/npm 10: `npm ci`, `npm run test:engine` (292/292), `npm run typecheck`, and `npm run build:vinext`. The native Cloudflare build emitted existing deprecation and large-chunk warnings, but succeeded.
- On the lockfile commit, isolated verification [#45181753662](https://github.com/MketyDigital/Factsport/actions/runs/45181753662), native Vinext build [#45181753506](https://github.com/MketyDigital/Factsport/actions/runs/45181753506), and protected Cloudflare app staging [#45181753400](https://github.com/MketyDigital/Factsport/actions/runs/45181753400) passed. Staging covered anonymous route denial, Media login/readiness boundaries, authorized DB/R2 health, Entra start/PKCE configuration checks, PostgreSQL-backed home/news/matches pages, share-card output, and protected match API access.
- The staging migration workflow [#45181753431](https://github.com/MketyDigital/Factsport/actions/runs/45181753431) and multi-league fixture import [#45181753747](https://github.com/MketyDigital/Factsport/actions/runs/45181753747) passed. ESPN preview [#45181753394](https://github.com/MketyDigital/Factsport/actions/runs/45181753394) and private R2/Hyperdrive smoke [#45181753585](https://github.com/MketyDigital/Factsport/actions/runs/45181753585) passed; the staging R2 bucket remained private.
- The temporary staging role-hardening Worker initially failed with Wrangler 4.166. Pinning that workflow to the same known-good Wrangler 4.158.0 used by the role-audit workflow fixed deployment. Exact commit `2898fd93de230c59eee7fd686d7031e14127d401`, staging hardening [#45182766508](https://github.com/MketyDigital/Factsport/actions/runs/45182766508) passed. It applied NOINHERIT and five-connection limits to the reader/schedule/ESPN roles, removed schedule-writer score INSERT grants, revoked default TEMP, verified the intended capabilities, and deleted its temporary Worker.
- The post-hardening read-only catalog audit found and corrected its own stale expectation: it still assumed 49 migrations through version 48. Staging has 51 migrations through version 50. The audit now verifies 51 distinct filenames and valid SHA-256 checksums and the workflow fails closed unless that ledger assertion is true. Temporary audit Workers are run-scoped and deleted after use.
- Exact current-head isolated verification [#45183840220](https://github.com/MketyDigital/Factsport/actions/runs/45183840220) and the post-hardening read-only staging role audit [#45183840282](https://github.com/MketyDigital/Factsport/actions/runs/45183840282) passed. The audit confirms database owner `mketydbadmin`, 51/51 checksummed migrations (versions 0–50), 80 public relations, 11 capability roles, and 308 inspected table privilege combinations. Role hardening confirms reader cannot write matches; schedule writer can insert fixtures but cannot write scores or settlement; ESPN writer can update linked/live fields but cannot alter teams/kickoff/settlement or insert/delete matches. Temporary Worker cleanup succeeded.

## Still open — production is not cutover-ready

- Real Entra editor sign-in, issuer+subject membership, effective RBAC, and authorized draft/review/publish/unpublish/logout with denial tests.
- Complete public Media route/feed/content/lifecycle parity and desktop/mobile visual, accessibility, SEO/crawler, rights, and Core Web Vitals acceptance; populated newsroom/highlight/featured content and provider-fed standings remain unproven.
- Full ESPN-linked match lifecycle, correction behavior, and schedule/score/settlement separation under runtime checks.
- V2-target backup/PITR/restore and route/DNS/rollback rehearsal; load and security acceptance.
- Owner evidence/decisions for Google AdSense site Ready and seller/legal eligibility, affiliate disclosures/rights, and VIP/prize/sportsbook policy.
- Private Prediction P9B and Factsport TV P10 remain separate later work; neither is part of a Media-only P9A release.

No production Worker/domain/DNS/database, main branch, legacy deployment, AdSense activation, or cutover was changed. The existing plan still requires all P9A evidence and an explicit written Media-only go/no-go after the release package is reviewable. A broad request to continue/cut over does not substitute for failed or unverified acceptance evidence.

## Next sequence

1. Complete the real staging Entra editor membership/RBAC/publish journey and its negative cases.
2. Finish the public Media route, data, rights, responsive, accessibility, crawler, and live-provider acceptance matrix.
3. Execute staging backup/PITR/restore and route/DNS rollback rehearsal, then load/security checks.
4. Reconcile each remaining P9A acceptance row with a run/page/result reference; prepare the exact Cloudflare release and rollback package.
5. Request the written Media-only release go/no-go only after that evidence is complete. Keep P9B and P10 gated separately.
