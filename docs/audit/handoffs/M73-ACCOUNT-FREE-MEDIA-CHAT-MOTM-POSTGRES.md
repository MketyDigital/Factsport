# M73 — Account-free Factsport Media chat and MOTM; PostgreSQL and Turnstile, no D1

Date: 2026-11-16
Branch: `refactor/factsport-v2`
Status: source and regression/staging acceptance tests committed. **Migrations, secret provisioning, full tests, Vinext build, connected Cloudflare staging and activation have NOT been performed.**

## Owner decision (overrides M70/M72 account assumptions)

Factsport.com Media and the separate `predict.factsport.com` Prediction product share infrastructure but **not participation entitlements**. Media visitors must be able to chat, vote MOTM and use similar public community features **without accounts, signup, email, Prediction membership, or marketing opt-in**. Media staff moderator/admin functions remain separately authenticated. Free anonymous Prediction entry retains its previously agreed email-and-consent submission policy; that is **not** used for Media community chat/votes.

The exact original fast ESPN/MOTM D1 and chat D1 Workers remain under `docs/audit/legacy-source/` for reference. **No active V2 D1 database, binding, read or write** is introduced.

## Identity and abuse controls

- A first visitor GET or qualifying POST receives a host-bound, signed **HttpOnly / Secure / SameSite=Lax** Media visitor cookie (secure scheme), using 32 random bytes and HMAC-SHA256. The server verifies its signature rather than trusting a client-selected voter or user ID. It stores a one-way SHA-256 token hash in PostgreSQL, not the raw browser cookie. On development HTTP only, a non-`__Host-` cookie name is used. Cookie Max-Age is 180 days.
- Separate secret bindings `FACTSPORT_MEDIA_VISITOR_SECRET` and `FACTSPORT_MEDIA_NETWORK_PEPPER` are required. Server-derived, daily-rotating network hashes use Cloudflare `cf-connecting-ip` and a secret pepper; no raw IP needs to be stored in the community tables. Untrusted `X-Forwarded-For` is not accepted as a substitute.
- The POST API requires a same-origin `Origin`, compatible Fetch Metadata, JSON request, strict field allowlists, a bounded body, authenticated server-side Cloudflare **Turnstile Siteverify** with expected hostname+action, and a dedicated PostgreSQL Hyperdrive connection. Turnstile token length capped at 2048 bytes and verification times out after 4.5 seconds. Tokens are single-use, expire within five minutes, and are reset by the client after submission. The widget is an abuse check **not a user account**. See https://developers.cloudflare.com/turnstile/get-started/server-side-validation/.
- PostgreSQL limits chat messages to once per visitor/registered actor per 3 seconds, plus a shared network minute bucket for chat (12 actions) and MOTM (8 actions), blocking trivial cookie resets and overlapping posts. These are bounded throttle controls **not a proof of one unique human**; VPNs, multiple devices, shared carrier NATs and bot challenges require staging fairness/abuse testing.

## Database migrations

- `0044` (existing) contains private chat/vote tables and public read views.
- `0045` (existing) has chat closure, link/reserved-markup, reply integrity and MOTM candidate/time validation triggers.
- `0046_factsport_anonymous_media_community.sql`:
  - Adds `media_visitor_participants` keyed by a one-way token hash, an optional `visitor_id` FK on chat/votes and an **exactly one of registered user or visitor** constraint; neither table requires an account for anonymous inserts.
  - Adds a **unique (match_id, visitor_id)** partial index for anonymous votes; existing registered-user uniqueness is preserved.
  - Adds network minute-rate ledger, visitor suspension tracking, and a guest-aware chat trigger that locks/rate-limits by actual visitor or registered user, checks match status and valid reply target and disallows public fake moderator markup/links.
  - Adds SECURITY DEFINER `submit_anonymous_media_chat` and `submit_anonymous_media_motm` routines, with canonical match ID or V1 UUID alias resolution. Automatic display label is a pseudonym (`Fan ` plus a short random-ID prefix); client-provided identity/avatar/role/email is never accepted.
  - Extends the public chat view with `reply_to_id`, **not private visitor/user IDs**.
- `0047_factsport_anonymous_media_community_role.sql`: creates a **NOLOGIN** `factsport_v2_community_api` capability role with EXECUTE only on the two narrow write functions and a private-cookie vote-state function. It has no direct table privileges. A separate staging credential/login and Hyperdrive binding are required; none are created or activated by this commit.

## Runtime implementation

- `lib/media/anonymous-community-visitor.ts`: secure cookie creation, verification, token/network hashing and first-read bootstrap.
- `lib/media/community-turnstile.ts`: server-side Cloudflare Turnstile Siteverify with strict token, hostname and action checks.
- `lib/adapters/postgres-client.ts`: `withFactsportCommunityPostgres` uses only `FACTSPORT_COMMUNITY_HYPERDRIVE`; no general-reader, legacy Supabase, editorial or Prediction credential fallback.
- `GET/POST /api/media/chat/messages`: public 50-message history, safe reply IDs, same-origin account-free POST with Turnstile and community functions. First-read cookie issuance prevents ordinary first-submit identity races.
- `GET/POST /api/media/motm`, `GET /api/media/motm/state`: read-only public totals; POST with Turnstile/secure cookie and database uniqueness; returning visitor vote state is read by verified cookie **before vote UI enables**, without localStorage being treated as proof.
- `FanZoneChat.tsx`: removes fan `useAuth`/Supabase dependency, previous client identity fields and direct legacy admin pin writes. The anonymous composer uses a guest pseudonym, protects replies, and resets Turnstile after attempts. Moderation pin management must be rebuilt under authenticated Media admin controls.
- `MOTMVoteWidget.tsx`: no login, email or localStorage proof; waits for backend guest-vote state, displays Turnstile and respects server result. Voting UI remains closed before kickoff and after 24 hours.
- `app/match/[id]/page.tsx`: displays community match tab when `FACTSPORT_MEDIA_COMMUNITY_BACKEND=postgres`, rather than development-only.
- Original external D1 chat and MOTM hostnames remain excluded from active V2 clients.

## Explicit staging activation gates (do not activate automatically)

1. Apply 0044 → 0045 → 0046 → 0047 **only on isolated V2 staging** after a migration/role audit and backups.
2. Provision a **new community-only login** with narrow inherited `factsport_v2_community_api` function EXECUTE capability and separately configured `FACTSPORT_COMMUNITY_HYPERDRIVE`. Verify this login cannot SELECT private visitor/vote tables or directly INSERT, UPDATE, DELETE, change roles or access Prediction/editorial resources.
3. Configure Cloudflare secrets `FACTSPORT_MEDIA_VISITOR_SECRET` (at least 48 characters), `FACTSPORT_MEDIA_NETWORK_PEPPER` (at least 48 characters), `FACTSPORT_MEDIA_TURNSTILE_SECRET` (from a verified Cloudflare Turnstile widget); separately configure the **public** `NEXT_PUBLIC_FACTSPORT_MEDIA_TURNSTILE_SITE_KEY` for the staging hostname.
4. On protected staging only, enable `FACTSPORT_MEDIA_COMMUNITY_BACKEND=postgres`, `FACTSPORT_MEDIA_COMMUNITY_WRITES=enabled` and `NEXT_PUBLIC_FACTSPORT_MEDIA_COMMUNITY_WRITES=enabled` together. Server and client flags must match. Source defaults remain fail-closed; no values are added to production.
5. Run `npm run test:engine`, `npm run typecheck`, `npm run build:vinext`, SQL acceptance files `tests/sql/media-community-write-integrity-acceptance.sql` and `tests/sql/media-anonymous-community-acceptance.sql` (both rollback-only), staging browser/Cloudflare Siteverify and Hyperdrive role probes, network/rate/abuse load and moderation/rights/AdSense checks.
6. Confirm action/hostname verification, cookie tamper rejection, bad origin, duplicate-vote status 409, network throttling 429, blocked/missing roster 422, anonymous chat reads, first-cookie issuance, expired/reused Turnstile tokens, different devices, carrier NAT fairness, moderation hides and long-term deletion/retention.
7. Provide Media-only moderation/report/mute/ban workflows, data retention and cleanup for `media_community_network_limits`, and deploy Cloudflare WAF/bot monitoring before enabling uncontrolled high-traffic chat. Do not reuse Prediction signup/membership to solve Media abuse controls.

## Limits and honesty

- **No account is needed** to participate by design, but a cookie does not prove one unique person. It discourages repeated voting in a single browser, not coordinated attempts with new cookies/devices/addresses. Turnstile, rate controls, suspension and future WAF/moderation form the defense in depth.
- Usernames are intentionally pseudonyms and may change if cookies are erased, protected sessions change, or different hosts are used. No email is added to marketing lists from Media chat or MOTM.
- Rate and moderation rules are staged assumptions; high-traffic/staging acceptance must adjust shared-NAT fairness and legitimate audience concurrency.
- There is no active D1 in V2. Staging and production credentials, databases, DNS, external legacy Workers, Stream.io, ads/billing and Cron jobs have **not** been modified.
- Full Node suite, TypeScript/Vinext build, SQL triggers, API runtime and real Turnstile/Cloudflare tests are unverified. Source inspection and committed tests are not passing CI.

This handoff **supersedes M72's requirement for a registered fan identity** for Media visitor submissions. Authenticated staff moderation remains separate. Prediction systems remain unchanged.

## Follow-up UI acceptance correction (2026-11-16)

MOTM widget now distinguishes **pre-kickoff** (`Voting opens at kickoff`), missing fixture time (`Voting unavailable`) and **post-24-hour** voting closure, preserving the database's kickoff-to-24-hour eligibility window. Regression test updated.

Commits: `2c32735fc912a123cd4ac7488df5dc7d0cb7176e`, `0034b335dbd3114eba58e6f3b16571872bf68938`.
