# AUTH-005 — Public anonymous predictions and one central Predict account

**Date:** 2026-11-07  
**Status:** owner-approved architecture; first V2 schema slice committed; API/runtime integration remains in progress.  
**Public host:** `https://factsport.com`  
**Registered account host:** `https://predict.factsport.com`  
**Scope:** staging/code only. No production DNS, database cutover, identity-provider changes or destructive data migration.

## 1. Owner decision

Factsport has exactly two user states:

1. **Public visitor / free participant:** may browse the public media product without registration. Only after choosing **Submit Prediction** does the site reveal a form requiring an email address, prediction details and acceptance of the free-prediction rules/privacy notice. This creates no account and invokes no authentication provider.
2. **Registered Predict member:** has one central Factsport account, registered and managed through `predict.factsport.com`. The same account/identity is used for any authenticated Factsport experience.

There is no intermediate email-only account. Email is a contact detail for the free-prediction/leaderboard workflow, not a login credential or account. The form is hidden until the visitor clicks Submit Prediction.

The email-marketing purpose is separate from the email needed to administer a prediction. The form includes a separate, optional, unticked marketing opt-in. Only an affirmative opt-in creates a marketing subscription. Declining marketing must not block a valid free prediction. Consent text/version, timestamp and source are recorded, and withdrawal/unsubscribe is honoured. A marketing opt-in is initially pending confirmation; no promotional email is sent until the address completes the confirmation flow.

## 2. Public prediction experience

- Public match pages, fixtures and free prediction viewing work without authentication or an email prompt.
- The prediction submission form appears only after an explicit click on **Submit Prediction**.
- Email is required on that form and is used to identify the free-prediction contact/leaderboard participant; it does not create an account and is never used as a password or authentication factor.
- Use a cryptographically random, opaque visitor token in a Secure, HttpOnly cookie scoped to `.factsport.com` when cross-subdomain continuity is required. Store only a one-way hash of the token in PostgreSQL. Never trust a client-supplied participant ID.
- Associate the participant with a normalized contact email. Use a privacy-safe display name or generated pseudonym on the public leaderboard; never expose email addresses.
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
- prediction contact records containing the email required at submission, separate from registered user identity;
- separate optional marketing subscription state and append-only consent evidence (purpose, channel, exact wording/version, timestamp, source, confirmation and withdrawal).

The server-side prediction API must:
- issue/rotate the anonymous cookie safely;
- validate same-origin/CSRF and rate limits;
- reject malformed UUIDs, unsupported outcomes, invalid scores, closed matches and duplicate/replay attempts;
- use the database as the final authority for kickoff lock and uniqueness;
- collect a syntactically valid email only when the visitor explicitly opens the Submit Prediction form; never call an authentication provider or create an account on this path;
- record marketing subscription only when a separate, optional and unticked marketing checkbox is affirmatively selected;
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
- No email prompt during browsing; email is required only when the visitor opens Submit Prediction.
- No automatic marketing subscription from merely submitting a prediction.
- No compulsory marketing consent as a condition of free participation.
- No anonymous prize entitlement by default.
- No auto-linking by email.
- No deletion, reset or silent reassignment of legacy predictions, users, VIP memberships, subscriptions, payments, prize records or settlement history.
- No production DNS, Worker, Entra tenant/app, database or secret changes without their separate approvals.
- This architecture improves AdSense separation but does not guarantee Google approval; the actual content and commercial model remain subject to Google's review.

## 9. Acceptance criteria

- An unauthenticated visitor can browse without an email prompt; clicking Submit Prediction reveals the form.
- The revealed form requires an email and prediction details, but creates no Entra/Supabase account and invokes no identity provider.
- The marketing checkbox is optional and unticked by default; declining it does not block prediction submission.
- Only an affirmative marketing opt-in creates a pending marketing subscription; consent evidence and withdrawals are auditable.
- Marketing sends are blocked until the subscription confirmation flow is completed.
- Duplicate/replayed submissions and post-kickoff writes are rejected server-side and by database constraints.
- Visitor identity is opaque, first-party, HttpOnly/Secure, hashed at rest and not exposed to the browser as a database key.
- Registering on Predict in the same browser can safely claim eligible anonymous history without email matching or overwriting conflicts.
- A registered user has one canonical Factsport account across both hosts.
- All existing VIP/premium/prize capabilities and transactional records remain preserved.
- Newsletter consent, if implemented later, is separate, explicit and auditable.
- Public and private app deployments, data access, ad configuration and route policies are independently tested.


## 10. First implementation slice (2026-11-07)

- Added `db/migrations/0003_factsport_public_predictions.sql` with prediction contacts, pseudonymous visitor participants, prediction rows, claim audit events and explicit same-match conflict records.
- Email is stored as a prediction contact after the user opens Submit Prediction and submits the form; it is not an account identity. The migration adds a separate marketing subscription and append-only consent-event ledger. Marketing status defaults to pending confirmation and is never inferred from the presence of an email.
- Predictions have database-level participant/match uniqueness, registered-user/match uniqueness, allowed-outcome checks, paired nonnegative score checks, kickoff lock timestamp, campaign snapshot and default `is_eligible_for_prize = false`.
- Claim conflicts have explicit records so a same-match collision cannot silently overwrite either prediction.
- Added `tests/prediction-schema.test.cjs` and wired it into the isolated V2 verification workflow. Tests cover email-contact/account separation and independent marketing consent records.
- **Not yet applied to Azure PostgreSQL.** The migration is checked in only. The current Hyperdrive application runtime is read-only; the dedicated prediction API writer role/Hyperdrive, API route, visitor cookie, claim transaction and PredictionBoard migration must be implemented and verified before enabling public submissions.
- No production database, DNS, Worker route, identity provider or legacy Supabase record was changed.


## 11. Owner clarification — submit-triggered email capture (2026-11-07)

The owner clarified the exact UX: no email form during ordinary browsing. A visitor sees the free prediction controls; only when they click **Submit Prediction** does the form reveal the required email field, required acceptance of the free-prediction rules/privacy notice, and a separate optional unticked marketing checkbox. Submitting a valid free prediction places the participant on the free leaderboard using a privacy-safe display identity. The email is not an account and is not a login credential. The separate Predict product still requires full registration.

**Marketing safeguard:** do not make direct-marketing consent compulsory for free participation. Nigeria's data-protection framework and current guidance require specific consent for direct marketing; consent must be a genuine, informed choice and withdrawal must be respected. The optional marketing checkbox should say exactly what Factsport emails will be sent. A separate pending-confirmation subscription and auditable opt-in/confirmation/withdrawal events are in the schema. No marketing email is sent before confirmation. Declining marketing does not prevent prediction submission. See current NDPC/NDPA sources recorded in the project discussion; legal review of final copy and cross-border email-provider processing remains required.

The V2 schema migration was revised before application (it has not been applied to Azure). The public PredictionBoard remains legacy Supabase-backed and login-gated until the new API, writer role and staging tests are ready.
