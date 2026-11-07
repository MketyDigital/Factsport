# M25 — Public settings contract split across Media and Prediction

Date: 2026-11-07
Branch: refactor/factsport-v2
Status: additive Prediction schema and separate readers implemented; M30 supersedes the original combined API facade. No legacy values imported and production flags remain off.

## Legacy response contract

The legacy public GET /api/settings returned five frontend fields:
- link1x
- linkMel
- code1x
- codeMel
- featured_match_id

The first four are Prediction monetization/referral settings. featured_match_id controls the Media homepage featured match. These values must not be copied into one shared settings table.

## V2 ownership

- Media owns homepage featured match selection through homepage_settings/public_homepage_settings.
- Prediction owns affiliate display values through prediction_affiliate_settings/public_prediction_affiliate_settings (migration 0018).
- Payment credentials, provider tokens, admin secrets and account-level secrets are not part of this public projection.
- The public reader receives SELECT on the narrow Prediction view only; the Media editorial writer receives no access to the Prediction settings table.
- A dedicated Prediction admin role is required before the settings can be edited in V2.

## Superseding API boundary (M30)

The initial compatibility facade was superseded to enforce the AdSense-first public Media boundary.

- Public GET /api/settings returns only Media-owned homepage fields: featured_match_id, announcement_text, announcement_link and announcement_enabled.
- Private GET /api/prediction/settings returns link1x, linkMel, code1x and codeMel only when the request hostname exactly matches FACTSPORT_PRIVATE_PRODUCT_HOST.
- The Prediction settings endpoint is force-dynamic and sends Cache-Control: private, no-store, max-age=0. It never exposes affiliate data to the public Media host.
- The FreeTipsBanner and BettingPromo private components now read the private Prediction endpoint and have no hardcoded affiliate URL/code fallbacks.
- Migration 0024 adds the announcement fields to homepage_settings and its narrow public view. These remain Media-owned.
- Public Media production pages no longer mount the legacy AuthProvider or account navigation. Dashboard, login, register, password recovery, VIP upgrade, private leaderboard and how-to-play routes are gated to the private product hostname.

The earlier five-field combined /api/settings response is no longer a valid V2 contract. Do not reintroduce it.

## Data migration requirement

No live affiliate values, custom affiliate codes or featured-match setting were read or copied. Import requires an authorized export from the legacy site_settings row and an explicit field-by-field reconciliation:
- link_1xbet/code_1xbet/link_melbet/code_melbet -> Prediction settings.
- social_config.featured_match_id -> Media homepage_settings.
Do not import any social access token, payment credential, webhook secret or other secret into either table.

## Validation and no-go conditions

Source tests verify the Media-only public response, private-host-only Prediction endpoint, separate adapter usage, view-only reader grant and fail-closed behavior. Migration 0018 has not been applied, Prediction writer role is not provisioned, flags are not enabled and no production settings have been changed. Do not enable either backend flag until migration and data reconciliation are complete.
