# AUTH-004 — Factsport isolated Entra staging blueprint and multi-cloud free-tier decision
Date: 2026-10-31. Source-verified product comparison; proposed tenant configuration; no Azure account/tenant changes, no keys generated, no prod writes.

## Owner confirmed: proceed with safe staging preparation
- Create **Factsport External ID external-configuration tenant**, separate from Mkety workforce/main Azure tenant. Use the existing Azure subscription ONLY as a linked billing owner (not tenant ownership transfer), and a clearly named resource group and budget.
- Microsoft's external tenant is a separate identity directory (separate apps, users, login policies and directory roles); it does not copy or expose workforce users. Subscription billing and the 50k MAU allowance may be aggregated across linked tenants. Source: https://learn.microsoft.com/en-us/entra/external-id/tenant-configurations ; https://learn.microsoft.com/en-us/entra/external-id/external-identities-pricing .
- Tenant creation requires subscription-scoped Tenant Creator access. Create from Microsoft Entra admin center in **external** configuration, not via Azure portal's ordinary workforce-tenant creation. Source: https://learn.microsoft.com/en-us/entra/external-id/customers/quickstart-tenant-setup
- Distinct labels: `Factsport Customers — Staging` (external tenant), `Factsport Web Staging` (app registration), `factsport-v2-staging` (resource group if required), explicit staging hostname callback. Do not invent/fix a URL until the preview domain is established and registered. Restrict tenant administrators.
- Initially configure browser-delegated OIDC Authorization Code + PKCE, Microsoft hosted email/password and verification/reset, no phone/SMS, no paid M2M, no add-on feature enablement. Application owns stable UUID, user role/entitlement/prediction records in Azure PostgreSQL. Store external issuer+subject mapping; never automatically link by email alone.
- Runtime configuration required: `AUTH_PROVIDER=entra-external`, `ENTRA_EXTERNAL_ISSUER`, `ENTRA_EXTERNAL_CLIENT_ID`, callback URL, authorized base host, session secret (and client secret if chosen confidential-client flow); server-only secrets in Cloudflare secret manager, no values committed. Actual Entra authority/discovery URL and redirect must be taken from configured app/tenant, not guessed.
- Browser session architecture: public live ESPN score endpoints stay public and 3s cached; auth operations only for signup/login or session refresh; session cookies validated server-side for chat, MOTM, predictions, VIP/admin; prohibit extra Entra token requests per 3-second frontend poll.
- Mkety Mail continues application transactional notifications, Entra handles first-party identity emails in initial version; no custom OTP extension until necessary.
- Staging tests: signup/login/logout/recovery, token validation/JWKS, CSRF state/PKCE/nonce, email verification, account link conflicts, VIP role enforcement, login burst quota, user data separation from Mkety enterprise directory, refresh/revocation, full session cleanup, auth-outage resilience. Not runtime verified.
- Cost guard: first 50,000 combined eligible MAU free for Basic, add-ons cost; alert at 30k/40k/45k (proposed, not configured). No tenant or billable resources currently created.

## Official comparison — current as of 2026-10-31
| Provider | Free | Limits/fit |
|---|---|---|
| Microsoft Entra External ID Basic | first 50k MAU combined eligible usage | separate consumer customer directory, subscription billing https://learn.microsoft.com/en-us/entra/external-id/external-identities-pricing |
| Google Cloud Identity Platform | first 50k MAU for tier-1 email/social; tier-2 SAML/OIDC only first 50 MAU | per-MAU fees beyond allowance https://cloud.google.com/identity-platform/pricing |
| Firebase Authentication with upgraded Identity Platform Spark | 3k DAU email/social for Spark Identity Platform, not universally every Firebase configuration | upgrade Blaze gives 50k monthly active tier; beware auth email quotas https://firebase.google.com/docs/auth |
| AWS Cognito Essentials/Lite | 10k MAU direct/social per account/org indefinitely; SAML/OIDC 50 MAU | OAuth/OIDC built-in, regional AWS setup https://aws.amazon.com/cognito/pricing/ |
| OCI IAM Free | 2k stored users; no end-user self-registration | OCI infrastructure IAM rather than general consumer auth https://docs.oracle.com/en-us/iaas/Content/Identity/sku/overview.htm |
| OCI External Active User | billed active users/month; no equivalent large free MAU allowance established | introduced Apr 21, 2026, consumer signup/social https://docs.oracle.com/en-us/iaas/releasenotes/identity/new-sku-mau-bill-meter.htm |

## Cross-provider adapter boundary
- `AuthIdentityProvider` performs startLogin, handleCallback, verifyIssuerClaims, logout; `UserIdentityRepository` owns immutable Factsport UUID and `(issuer,sub)` unique mappings; session and authorization operate on internal UUID, not provider-specific roles/tokens. Other providers may require reauth/certain email/oauth migration steps on cutover, so "no user notices" is a goal, not unconditional guarantee.
- Existing Supabase users/predictions/VIP need safe owner-approved migration or clean restart policy; no auth usernames/passwords copied without reviewed privacy and entitlements plan. Old production remains unchanged.
- Deployment prerequisites: Azure subscription authorizations, staging hostname, Entra admin tenant/app registration. No Azure management connector is connected; instructions are ready, actual tenant creation cannot be truthfully claimed.
