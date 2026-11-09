# M37 — Social image attachments and channel capability controls

Date: 2026-11-09
Branch: `refactor/factsport-v2`
Status: source implementation committed; isolated regression and native build passed on the current social-media source set; provider delivery remains disabled and unverified.

## Implemented

- Social publication scheduling now accepts up to four media asset IDs and includes them in idempotency matching. A reused idempotency key with a different media selection is rejected.
- Server validation requires each image to be an image asset with rights review, an allowed rights status, no expired usage window, public visibility and an active attachment to a reviewed/published editorial article or team-media placement.
- Added `GET /api/admin/social/media`, authorized for the Social capability. It returns only rights-cleared public images; it does not expose pending/private Media library assets or depend on the reader-only public view grant.
- Social composer can select public media and shows the selected image count on scheduled publications.
- Added migration `0031_factsport_social_channel_media_capability.sql` with `supports_media=false` by default. Image attachment is hidden in the composer and rejected server-side unless an operator explicitly marks the channel as image-capable after provider image-delivery E2E.
- Extended the migration inventory workflow through migration 0031 and added static contract tests for social media rights, idempotency and capability checks.

## Permission and safety details

- Social-role asset lookup uses the editorial writer's existing SELECT grants on article/media tables and repeats the public eligibility conditions. It does not rely on `public.public_media_assets` being granted to the editorial writer or expose the private media table through a new broad grant.
- Social posts remain in the public Media scope only. Private Prediction promotional content is still rejected by the existing policy gate.
- The `supports_media` default is false. No channel is implicitly enabled for images.
- No provider credentials, post dispatch, delivery receipts, retries or public social posting were activated by this change.

## Validation

- Isolated regression verification passed on commit `8ca2e24832113e82a3990d5694c33545113f04ec` (run `42558737483`).
- Native Worker build and isolated verification passed on commit `fa4a651594e859ec2cb8205c51de93737b26b6d6` (runs `42558698482` and `42558698548`).
- The protected staging workflow was still in progress at the last check. No editorial migrations were applied, no provider API was called and no real post was sent.

## Remaining Media distribution work

1. Implement the separate social dispatcher identity/Hyperdrive and durable claim/lease/retry/dead-letter/reconciliation lifecycle.
2. Wire the owner-confirmed Azure Logic Apps scheduler adapter without creating duplicate Cloudflare Cron scheduling.
3. Implement and contract-test direct Facebook and Telegram adapters; keep Buffer/Make behind the Logic Apps adapter as owner-decided.
4. Add delivery receipts, unknown-result reconciliation, rate limits, provider error normalization and operator retry controls.
5. Complete the independent match-event automation path: connect the pure detector to the canonical match commit, snapshot the M15 routing/templates, and fan out to the separate event outbox. Do not merge it with editorial scheduled posts.
6. Only after provider E2E, enable channel `supports_media` individually and verify single/multiple-image behavior for each provider.

## Safety

No provider credentials, Logic Apps workflow, social account, production database, public route or production setting was changed. No posts were sent.
