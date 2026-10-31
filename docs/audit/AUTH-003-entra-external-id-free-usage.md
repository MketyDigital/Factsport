# AUTH-003 — Microsoft Entra External ID Basic: free usage and Factsport fit
Date: 2026-10-31. Status: Microsoft official docs VERIFIED; engineering proposal only. No Azure tenant, app registration, keys, runtime auth or production writes.

## Identity product distinction
Use **Microsoft Entra External ID for customers in an EXTERNAL tenant**, not generic Microsoft Entra ID Free (workforce) and not legacy Azure AD B2C.

## Verified 2026-10-31 pricing
- Microsoft Entra External ID **Basic core**: first **50,000 monthly active users (MAU)** free. MAU is a unique external user with authentication activity during a calendar month, **not** registered-account count, requests, site visits or a per-second live score poll. When multiple eligible tenants are linked to a subscription, Microsoft aggregates covered MAUs; do not plan one 50k allowance per app.
- Beyond 50k MAU: paid usage per MAU. Microsoft public pricing page currently surfaces an unavailable/dynamic numerical rate; obtain Azure subscription/contract quote before projecting >50k or claiming a specific overage.
- Extra charges are **not covered by 50k Basic**: SMS phone auth by verification, machine-to-machine OAuth client credentials by transaction, optional Go-Local data residency. Avoid for MVP; do not authenticate routine Logic Apps background jobs via billable Entra M2M tokens.
- Azure subscription already owned by user; create external tenant under authorized subscription/resource group. External tenant and PostgreSQL are separately managed services; using Entra does not require additional VM, hosted Zitadel, or application password database.
Official: https://azure.microsoft.com/en-us/pricing/details/microsoft-entra-external-id/
Billing: https://learn.microsoft.com/en-us/entra/external-id/external-identities-pricing
FAQ: https://learn.microsoft.com/en-us/entra/external-id/customers/faq-customers

## Login functions and constraints
- Supports email+password, email OTP primary login, self-service password reset, browser-delegated Google/Facebook/Apple and federated OIDC identity methods.
- Email OTP can serve as an MFA second factor with password primary, but **cannot also be the MFA second factor for users whose primary login is email OTP**. SMS is premium. Passkey/FIDO2 options require eligible setup and custom URL for passkey registration; assess current support before promising all sign-in modes. For admin/high-value controls enforce MFA/step-up and isolated authorization.
- Microsoft-hosted browser-delegated UI can be branded with Factsport logo/colors/text/CSS and custom URL domain if configured, without rebuilding password handling in Factsport. Native auth allows wholly app-owned login UI but moves more responsibility to app; social federation requires browser-delegated auth. **Start browser-delegated**.
Docs: https://learn.microsoft.com/en-us/entra/external-id/customers/concept-authentication-methods-customers ; https://learn.microsoft.com/en-us/entra/external-id/customers/concept-multifactor-authentication-customers ; https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-customize-branding-customers

## Operational limits beyond MAU
- 200 requests/sec per external tenant; 20 requests/sec per IP per external tenant; trial tenant 20 req/sec; per-user-flow authorization requests vary (~4 per sign-in and ~6 per sign-up, plus OTP).
- Published initial tenant object cap is 300,000 objects (users and apps) before Microsoft support increase; a **trial** tenant is limited to 10,000 objects. Use linked subscription-backed tenant, not temporary 30-day trial, for production planning.
- Rate/issuance limits and 50k free MAU are unrelated. Login bursts must be protected and load tested. Do not send 3-second ESPN live polling or chat polling to Entra; use application session verification with HTTP-only cookie and canonical user ID.
Docs: https://learn.microsoft.com/en-us/entra/external-id/customers/reference-service-limits

## Factsport compatibility and low-cost topology
- vinext/Cloudflare Worker serves /auth/login -> Entra browser-delegated Authorization Code + PKCE -> registered /auth/callback -> validate state, nonce, issuer, audience, signature (JWKS), expiry -> find/create immutable Factsport user ID mapped to `external_identity(issuer,subject,factsport_user_id)` in Azure PG -> issue/rotate HTTP-only first-party session cookie. Server validates session and authorization for predictions/VIP, chat, MOTM and admin. No 3s login calls.
- Factsport app owns user profiles, predictions, campaign history, VIP/subscriptions, role assignments and audit logs, **not** password hashes. Never auto-link accounts by email alone; preserve existing Supabase IDs/eligible entitlements per owner-approved migration.
- Works conceptually via standards-based OIDC; **vinext/Cloudflare runtime SDK and cookie behavior still need a staging PoC and tests**. Keep AuthProvider interface so Entra can be replaced with Better Auth, Clerk or Mkety Auth; user may need reauthentication at provider transition.
- Mkety Mail remains app transactional email (welcome, account notices, campaigns). Entra can send its own standard auth emails. Optional custom emailOtpSend extension can call Factsport's Mkety Mail adapter, but brings extra API, 2-second extension timeout and quotas, so leave disabled initially. Official: https://learn.microsoft.com/en-us/entra/identity-platform/custom-extension-email-otp-get-started ; https://learn.microsoft.com/en-us/entra/external-id/customers/reference-service-limits
- External tenant creation: https://learn.microsoft.com/en-us/entra/external-id/customers/quickstart-tenant-setup
- Azure PG B1ms ~$16–20/mo **planning estimate for DB only** unchanged; Entra core $0 if within shared free MAU allowance and no add-ons. Azure Logic Apps metering, Cloudflare Workers, R2 and Mkety Mail unrelated extra costs.

## Staging acceptance gates
1. Subscription-linked EXTERNAL tenant, external customer app registration, client redirect/logout exact domain, branded login; avoid accidental workforce/legacy B2C tenant.
2. Test email+password, email OTP, password reset, sign-in/sign-out, optional social account, duplicate and blocked user, token expiry, session refresh and admin MFA.
3. Test verified issuer+subject mapping, migrated owner-approved identities, prediction/VIP authorization and account deletion/export.
4. Test Cloudflare/vinext runtime interoperability, CSRF/PKCE, secure callbacks, JWKS refresh, tenant outage handling and public match data unaffected.
5. Configure MAU spend monitoring and 30k/40k/45k alerts (proposed thresholds), plus extra add-on prevention/budget alerts; obtain precise >50k price in subscription.
6. Do not create billable resources, enable sign-in in production, or change Supabase until owner approval and staging parity.

## Recommendation
Entra External ID Basic is a credible **zero-additional-core-authentication-fee, low-maintenance** solution up to 50k MAU if it meets feature/tenant requirements. Prefer it over new self-hosted Zitadel for Factsport while testing its Cloudflare Worker integration. Final provider selection remains pending actual staging proof.
