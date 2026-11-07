# AUTH-005 — Public anonymous predictions and one central Predict account

**Date:** 2026-11-07  
**Status:** owner-approved architecture; implementation starts on `refactor/factsport-v2`.  
**Public host:** `https://factsport.com`  
**Registered account host:** `https://predict.factsport.com`  
**Scope:** staging/code only. No production DNS, database cutover, identity-provider changes or destructive data migration.

## 1. Owner decision

Factsport has exactly two user states:

1. **Public visitor (anonymous):** may browse the public media product and submit free predictions without registration, login, email address or email verification.
2. **Registered Predict member:** has one central Factsport account, registered and managed through `predict.factsport.com`. The same account/identity is used for any authenticated Factsport experience.

There is no intermediate email-identified participant account. The public prediction form must not require or request an email address.

The prediction form is not a newsletter signup. Do not collect an email address for marketing through prediction submission. If Factsport later offers newsletters or product updates, that must be a separate optional signup with a clear, unbundled consent and unsubscribe mechanism.

## 2. Public prediction experience

- Public match pages and free prediction submission work without authentication.
- Anonymous identity is a first-party pseudonymous browser participant, not an account and not an email identity.
- Use a cryptographically random, opaque visitor token in a Secure, HttpOnly cookie scoped to `.factsport.com` when cross-subdomain continuity is required. Store only a one-way hash of the token in PostgreSQL. Never trust a client-supplied participant ID.
- The cookie is for prediction continuity and abuse controls; it must not be used as a cross-site advertising identifier.
- Prediction submissions go through a server-side API/Worker. Never permit direct browser writes to prediction tables or expose database/service-role credentials.
- The server validates the match exists, prediction is still open using authoritative server time, outcome/score bounds, duplicate rules, campaign rules and request limits. Enforce uniqueness/idempotency in PostgreSQL as well as in application logic.
- Public visitors can continue reading and predicting without an account. Do not imply that anonymous predictions can be recovered after browser storage/cookies are cleared.
- If anonymous free points/leaderboard participation is enabled, use a pseudonymous display identity and privacy-safe public output. Do not expose visitor tokens, hashes, IP addresses or emails.

## 3. Registered Predict account

- `predict.factsport.com` owns registration, login, logout, recovery, profile, account settings, memberships, subscriptions, VIP entitlements and prize eligibility.
- One Factsport internal immutable UUID is the canonical user ID. External identity is mapped by verified `(issuer, subject)`; email alone must never auto-link identities or legacy accounts.
- Microsoft Entra External ID remains the Day 1 authentication adapter, subject to isolated staging proof. Keep the provider-neutral adapter.
- Server-side authorization and database entitlements are authoritative. Client-side UI hiding is not authorization.
- A registered member can use the same account on both experiences. Authenticated state may be shared across the two subdomains using carefully configured first-party session cookies, but cookie domain, CSRF, origin checks, session rotation/revocation and logout behavior must be tested before rollout.

## 4. Anonymous-to-account transition

- When a visitor registers/logs in on Predict in the same browser, the server may associate the current anonymous participant with the authenticated internal user using the protected visitor cookie.
- This is a controlled server-side claim operation. It must not accept a visitor ID from request JSON, match by email, or permit one participant to be claimed by two accounts.
- If the authenticated user already has a prediction for the same match, apply a documented deterministic conflict rule and preserve both original records/audit history; never silently overwrite a locked prediction.
- Multi-device anonymous predictions are not automatically recoverable. A visitor who changes browser/device before registering may lose the ability to associate those anonymous predictions. Explain this honestly in product copy if history is presented.
- Once linked, the account is the canonical owner for authenticated views and eligible registered-member features.

## 5. Rewards, prizes and marketing boundaries

- Anonymous participation in a free prediction is not automatically eligibility for cash prizes, paid membership benefits or any restricted campaign. Eligibility is checked server-side against the specific campaign rules and applicable age/geography/identity requirements.
- Registration does not retroactively make an ineligible prediction prize-eligible. Preserve campaign snapshots, timestamps, locks, settlement history and audit trails.
- Do not add bookmaker affiliate promotions, odds funnels, VIP/prize sales copy or private product ads to public editorial/prediction pages as a way around Google policy.
- Newsletter/product marketing consent is a separate purpose from prediction submission. Store consent evidence separately (timestamp, wording/version, source and withdrawal) and use verified email only where required by the mailing provider/law.

## 6. Data and API implementation contract

The V2 PostgreSQL design must support:
- anonymous prediction participant records with hashed opaque visitor token;
- a nullable registered `app_users.id` association, with a safe one-participant-to-one-account claim invariant;
- prediction records linked to a participant and match, with outcome, optional exact score, custom-market snapshot, submission timestamp, lock/campaign snapshot and settlement/points state;
- database uniqueness for one allowed submission per participant/match and idempotent retries;
- auditable participant-claim/conflict events;
- separate marketing-consent records only if/when a newsletter feature is implemented.

The server-side prediction API must:
- issue/rotate the anonymous cookie safely;
- validate same-origin/CSRF and rate limits;
- reject malformed UUIDs, unsupported outcomes, invalid scores, closed matches and duplicate/replay attempts;
- use the database as the final authority for kickoff lock and uniqueness;
- avoid email, authentication-provider calls or account creation on the anonymous prediction path;
- expose only the current visitor's own prediction state and safe public aggregate/leaderboard data.

Do not implement browser-side direct writes, trust a client clock, or use an email address as an anonymous identity key.

## 7. Safe implementation sequence

1. Inventory the existing `user_predictions`, profiles, campaign, settlement, points and RLS contracts in the legacy source and current V2 DB plan.
2. Finalize and review the V2 participant/prediction schema and migration, including least-privilege grants for a dedicated prediction API runtime role.
3. Implement and test the anonymous visitor cookie/session and server-side prediction API against isolated staging PostgreSQL.
4. Migrate the public PredictionBoard to the API without removing current scoring, campaign or bonus-market behavior.
5. Implement same-browser anonymous-to-account claim and conflict handling.
6. Implement the Predict-host Entra flow and shared authenticated session; test subdomain CSRF, callback, cookie scope, logout and authorization.
7. Preserve/migrate existing Supabase user, prediction, VIP, subscription and prize records only under the separately approved migration plan. Do not change or delete production data.
8. Run browser journeys: anonymous prediction, repeat/duplicate, kickoff race, invalid input, rate limit, cookie loss, signup/login, account claim, multi-device, existing-account conflict, campaign lock, settlement and admin audit.
9. Verify that public editorial and anonymous prediction pages do not load login prompts or AdSense-ineligible private promotions; verify private Predict host has no AdSense code.

## 8. Explicit non-goals and safety gates

- No second email-only user type.
- No email field in the public prediction form.
- No marketing opt-in bundled into predictions.
- No anonymous prize entitlement by default.
- No auto-linking by email.
- No deletion, reset or silent reassignment of legacy predictions, users, VIP memberships, subscriptions, payments, prize records or settlement history.
- No production DNS, Worker, Entra tenant/app, database or secret changes without their separate approvals.
- This architecture improves AdSense separation but does not guarantee Google approval; the actual content and commercial model remain subject to Google's review.

## 9. Acceptance criteria

- An unauthenticated visitor can submit a valid free prediction without email or registration.
- No anonymous prediction path creates an Entra/Supabase account or invokes the identity provider.
- Duplicate/replayed submissions and post-kickoff writes are rejected server-side and by database constraints.
- Visitor identity is opaque, first-party, HttpOnly/Secure, hashed at rest and not exposed to the browser as a database key.
- Registering on Predict in the same browser can safely claim eligible anonymous history without email matching or overwriting conflicts.
- A registered user has one canonical Factsport account across both hosts.
- All existing VIP/premium/prize capabilities and transactional records remain preserved.
- Newsletter consent, if implemented later, is separate, explicit and auditable.
- Public and private app deployments, data access, ad configuration and route policies are independently tested.
