# M25 — Public settings contract split across Media and Prediction

Date: 2026-11-07
Branch: refactor/factsport-v2
Status: additive Prediction schema and separate readers implemented; no legacy values imported and production flags remain off.

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

## Compatibility API

GET /api/settings remains a compatibility facade for existing frontend consumers. When both backend flags are set, it reads Media and Prediction projections independently in parallel, then returns the same five-field response shape. The response is combined only at the public API boundary; database ownership and permissions remain separate.

- FACTSPORT_HOMEPAGE_BACKEND=postgres selects the Media homepage view.
- FACTSPORT_PREDICTION_SETTINGS_BACKEND=postgres selects the Prediction affiliate view.
- In staging and production, if either projection is not provisioned, the endpoint returns 503 and does not silently fall back to the legacy mixed Supabase settings row.
- The old mixed settings read is retained for local development compatibility only.

## Data migration requirement

No live affiliate values, custom affiliate codes or featured-match setting were read or copied. Import requires an authorized export from the legacy site_settings row and an explicit field-by-field reconciliation:
- link_1xbet/code_1xbet/link_melbet/code_melbet -> Prediction settings.
- social_config.featured_match_id -> Media homepage_settings.
Do not import any social access token, payment credential, webhook secret or other secret into either table.

## Validation and no-go conditions

Source tests verify response shape, separate adapter usage, view-only reader grant and fail-closed production/staging behavior. Migration 0018 has not been applied, Prediction writer role is not provisioned, flags are not enabled and no production settings have been changed. Do not enable either backend flag until migration and data reconciliation are complete.
