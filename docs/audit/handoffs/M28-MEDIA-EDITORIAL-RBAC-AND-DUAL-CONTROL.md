# M28 — Media editorial RBAC, dual-control publishing and admin boundary

Date: 2026-11-07
Branch: refactor/factsport-v2
Status: source implementation added; database roles, membership data and writer Hyperdrive remain unprovisioned.

## Domain-owned Media roles

Migration 0020 adds:
- media_editorial_memberships: explicit internal user-to-role grants with grantor, reason, grant time, revocation actor/time and reason. Active duplicate grants are prevented by a partial unique index.
- media_editorial_audit_events: append-only action history for draft, review, publication, archive, rights review, social scheduling/cancellation and membership changes.
- factsport_v2_media_access_admin: separate provisioning identity for role grants/revocations.
- factsport_v2_editorial_writer: may read role memberships and append editorial audit events; cannot grant or revoke roles.

Role capabilities are intentionally separated:
- writer: create/update draft revisions and submit for review.
- editor: review/approve submitted revisions and review media rights.
- publisher: publish already-approved revisions and archive content.
- social_manager: schedule/cancel social publications.
- media_admin: all Media editorial capabilities.

The active role lookup uses the authenticated provider session only to establish the external subject, then resolves a unique internal Factsport user and role membership through the PostgreSQL identity bridge. Email address, hardcoded allowlist, profiles.role and user metadata are not authorization inputs.

## Three-stage editorial publication

The former combined approve-and-publish action is removed:
1. Writer saves an immutable revision and submits it.
2. A different editor approves the revision. Approval records reviewer identity and timestamp but does not change the public article.
3. A distinct publisher publishes the approved revision. The author, submitter and reviewer cannot be the publisher.

The publisher transaction rechecks every attached image's rights approval and expiry, applies the approved snapshot, promotes only revision-attached media and records the publish event. The currently published article remains visible while a new revision is being drafted/reviewed.

## Admin system boundary

The former mixed /admin command centre, Match Manager and User Directory were archived verbatim and removed from active V2 operation:
- /admin is now a Media-only landing page.
- /admin/news, /admin/social and /admin/studio are Media surfaces with capability checks.
- /admin/matches is a non-writing readiness page pending a provider-aware Media match editor.
- /admin/users is a boundary page; account, Prediction VIP, payment, campaign, settlement and prize operations must be implemented in Prediction administration, not the Media workspace.
- The shared email allowlist and legacy admin PIN/vault are no longer used by the active Media admin shell.
- Existing source files remain under docs/audit/legacy-source/ for parity/reference.

## Audit coverage

Draft save, review submission, review approval, publication, archive, media-rights review, social scheduling and social cancellation now append an audit row in the same PostgreSQL transaction as the business mutation. This prevents successful mutations without corresponding audit evidence.

## Provisioning and cutover gates

1. Provision factsport_v2_media_access_admin and factsport_v2_editorial_writer with independent least-privilege credentials and bounded Hyperdrive connections.
2. Apply migrations 0009–0020 in dependency order after schema/role verification.
3. Explicitly map existing approved Media operators to internal app_users IDs and grant roles with reason/approver. Do not auto-link by email.
4. Verify writer/editor/publisher/social_manager role matrix against staging database; test self-approval and distinct publisher enforcement.
5. Build a controlled role-management action for media admins and audit every grant/revocation.
6. Add approval comments, rejection/change requests, revision diff/restore and preview parity.
7. Complete actual PostgreSQL integration tests and E2E with two distinct editor identities and a third publisher identity.

No membership grants have been imported, no production roles provisioned, no migration applied and no production data or admin accounts changed.
