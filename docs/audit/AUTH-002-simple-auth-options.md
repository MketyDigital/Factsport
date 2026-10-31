# AUTH-002 — Simplest authentication choices: Better Auth vs Entra External ID vs Cloudflare

Date 2026-10-31. Research only; no runtime tests or production change.

## Goal
Factsport 2.0 already pays for one small Azure PostgreSQL Flexible Server (target Burstable B1ms, 32 GiB). Frontend and APIs stay Cloudflare Workers/vinext. User wants simple, reliable, lowest-maintenance and portable user/auth with no new container/VM or expensive subscriptions. Mkety Mail will send transactional notifications.

## Verified alternatives

### Better Auth: embedded application auth + existing PostgreSQL
Official docs: https://better-auth.com/docs/basic-usage , https://better-auth.com/docs/installation , https://better-auth.com/docs/adapters/drizzle , https://better-auth.com/docs/plugins/2fa , https://better-auth.com/docs/concepts/rate-limit
- OSS library embedded in Factsport app. Email/password, OAuth, sessions, email verification and recovery, configurable rate limits; optional TOTP 2FA, backup codes and passkeys. PostgreSQL supported through Drizzle adapter; auth table namespace can be named `auth`.
- No extra identity service, new VM or separate auth subscription. Data lives in existing Azure PostgreSQL and could migrate to another ordinary PostgreSQL host with portable migrations.
- Must still implement proper security configuration: secure httpOnly same-site cookies, CSRF/session origin checks, encryption/secret rotation, auth email via Mkety Mail, admin step-up enforced at every privileged route (plugin credential-based MFA does not automatically cover passwordless/OAuth flows), Cloudflare Turnstile/captcha as appropriate, IP/account rate limiting, link/unlink identity, allowlist local callback origins, database retention and backup/restore.
- In particular **Cloudflare Workers/vinext support of the selected version and driver/Hyperdrive bindings must be verified in staging**; do not assume Node-only package/APIs are compatible. B1ms connection pressure/CPU credit and session read counts must be tested. This solution shifts operational/security maintenance to Factsport team despite no subscription.

### Azure Microsoft Entra External ID Basic: managed CIAM
Official: https://azure.microsoft.com/en-us/pricing/details/microsoft-entra-external-id/ , https://learn.microsoft.com/en-us/entra/external-id/customers/overview-customers-ciam , https://learn.microsoft.com/en-us/entra/external-id/customers/concept-authentication-methods-customers
- **First 50,000 MAU free** for core offering, requires separate external tenant and linkage to subscription for pricing. Optional premium add-ons e.g. SMS and additional capabilities may cost.
- Manages customer accounts, credential verification, recovery and hosted sign-in flows. Supports email/password or email OTP, social accounts with browser-delegated flow and Microsoft identity protocol. No new server or database burden; operationally least work to maintain.
- Microsoft-hosted login journey and Entra tenant configuration add vendor dependence and setup; custom domains and brand styling possible. Factsport must verify OIDC authorization code + PKCE, session validation, admin security and Cloudflare Workers/vinext support. Store external `issuer + subject` mapping to stable internal Factsport UUID and keep VIP/business roles independent.
- This has **different** 50k MAU metric from Clerk 50k monthly retained users and ZITADEL 100 DAU; do not compare as equivalent. Paid tier beyond free threshold/optional MFA add-ons require region-specific quote.

### Cloudflare Workers and D1
- Workers is an execution platform not a complete built-in consumer authentication provider. Access/Zero Trust helps protect admin/internal Workers but is NOT a replacement for sitewide fan signup/session flow. https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- Could run Better Auth on Workers + D1, but then user/session store split from PostgreSQL; choose existing Azure PG unless clearly better on cost/reliability. Additional D1 may increase provider complexity; no need to invent bespoke password hashing/session crypto.

## Cost/maintenance recommendation
- **Simplest to own/control and lowest additional recurring auth fee**: Better Auth + Azure PostgreSQL + Mkety Mail, contingent on Cloudflare compatibility tests, a security review and measured B1ms query overhead.
- **Lowest security maintenance**: Entra External ID Basic for first 50k MAU, contingent on features/tenant setup and verifying exact extras. No self-host; Microsoft handles credential lifecycle.
- Prefer not to self-host ZITADEL solely for Factsport on B1ms: the auth process still needs independently hosted compute and adds DB load, TLS, patches, backups, resilience work.
- Use a stable `IdentityProvider` abstraction and `auth_external_identities(issuer, subject, factsport_user_id)` map. A switch of auth provider requires deliberate migration and potentially user reauthentication, **not guaranteed invisible**, but preserves profiles/predictions/VIP.
- In staging run two small PoCs: (A) Better Auth on vinext Workers using Azure PG/Hyperdrive and Mkety Mail; (B) Entra External ID OIDC login callback + stable user mapping. Compare security, setup, latency, operational effort and required add-ons. Do not provision paid services or change live signups without owner approval.

## Decision gate
Owner to choose app-owned Better Auth versus fully managed Entra after 2 PoCs; favor Entra if minimizing identity operations matters more than using first-party auth tables. For a fans-first website low traffic, either can satisfy basic functional requirements. Audit source-based only, no runtime proof.
