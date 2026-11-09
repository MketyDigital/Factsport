# M46 — AdSense, publisher transparency and SEO indexing gates

Date: 2026-11-09
Branch: refactor/factsport-v2
Status: fail-closed readiness hardening implemented; no ads are served and no AdSense/CMP approval is claimed.

## Implemented

- Replaced the root layout's unconditional `index, follow` metadata with request-host-aware `generateMetadata()`.
- The root metadata now emits `noindex,nofollow` (including Googlebot) when:
  - the request is on `FACTSPORT_PRIVATE_PRODUCT_HOST`;
  - the deployment is not production;
  - `FACTSPORT_INDEXING_ENABLED` is not explicitly true; or
  - any of the PostgreSQL editorial, matches or sitemap backend flags is not ready.
- The gate matches the existing `app/robots.ts` and `app/sitemap.ts` conditions. Private Predict host remains non-indexable even if public Media indexing is enabled.
- Existing `lib/adsense-policy.ts` remains fail-closed: ad rendering requires explicit enabled/approved/consent-ready state, a valid publisher ID, exact `factsport.com` host and an approved public editorial route.
- `public/ads.txt` contains one syntactically valid Google seller record. CI checks its format and uniqueness; this does not verify the publisher ID against the owner's live AdSense account or prove the production host serves the file.
- Privacy and Advertising Policy pages explicitly state that AdSense is not currently enabled and describe the certified-CMP requirement for relevant regions.
- No AdSense script, ad unit or third-party advertising request is loaded by the V2 application. Public Media remains separated from Prediction/VIP/affiliate promotions.

## Verification

- Isolated verification passed on commit `3b915b0b...`, run [42574256321](https://github.com/MketyDigital/Factsport/actions/runs/42574256321), including the new root robots metadata and ads.txt contract tests.
- Native Vinext build passed on the same commit, run [42574256073](https://github.com/MketyDigital/Factsport/actions/runs/42574256073).
- Later M45 changes remain under their own verification runs; see M45.
- No production deployment or live-domain AdSense check was performed.

## External/account gates still open

1. Owner must verify that the publisher ID currently in `public/ads.txt` belongs to the active Factsport AdSense account and that the production `https://factsport.com/ads.txt` returns HTTP 200 with that exact authorized seller record.
2. Owner must confirm AdSense account/site approval and any account-specific policy warnings.
3. Select and configure a Google-certified CMP (or another verified certified provider) with IAB TCF support where required. No home-built consent banner is treated as a certified CMP.
4. Complete consent-state tests for EEA/UK/Switzerland and other applicable jurisdictions; keep the consent-ready input false until the CMP has been verified.
5. Owner/legal review of Privacy Policy, Advertising Policy, Terms, contact details and the actual ad placements.
6. Only after the above, supply approved ad-unit IDs and implement lazy ad slots on explicitly approved public editorial routes. Do not place ads on prediction, VIP, payment, account, match-interaction or admin surfaces.

## Safety

- `FACTSPORT_INDEXING_ENABLED` remains off until public content, live host and sitemap are approved.
- No CMP is configured and no consent-ready state is enabled.
- No ad script or ad unit is enabled.
- The static ads.txt line is syntax-checked only; it is not treated as account verification.
- No production DNS, Worker route, database, AdSense account, publisher settings, public content or user data was changed.


## Protected staging follow-up — 2026-11-09

- Protected Cloudflare application staging passed on source commit `67c7d8b13138fa9da4242bb3aabf6b70a106f8cf`, run [42574631386](https://github.com/MketyDigital/Factsport/actions/runs/42574631386). This includes the host-aware robots metadata and ads.txt format guard in the source bundle.
- The staging worker is intentionally protected and does not prove that the live public production host serves `/ads.txt`, that the publisher ID belongs to the active account, that AdSense has approved the site, or that a certified CMP is configured.
- No AdSense script, ad unit or production indexing flag was enabled.
