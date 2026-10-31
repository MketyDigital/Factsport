/**
 * Factsport identity boundary. An identity provider authenticates a human;
 * Factsport's own PostgreSQL owns authorization, entitlements and user IDs.
 * This file is a passive type contract; NOT a working login integration.
 */
export interface VerifiedExternalIdentity {
  issuer: string;
  subject: string; // unique only together with issuer
  email: string | null; // NEVER sufficient to auto-link old accounts
  emailVerified: boolean;
}

export interface StartLoginInput {
  returnTo: string; // validated same-origin relative destination only
  state: string; // per-request unguessable value kept in protected session
  nonce: string;
  codeChallenge: string; // PKCE S256
}

export interface IdentityProvider {
  authorizationUrl(input: StartLoginInput): Promise<string>;
  // Implementation MUST validate issuer, audience, signature (JWKS), state,
  // nonce, expiry, exact callback, PKCE verifier, and replay protection.
  exchangeAndVerifyCallback(input: {
    code: string;
    state: string;
    codeVerifier: string;
    expectedNonce: string;
  }): Promise<VerifiedExternalIdentity>;
  logoutUrl(postLogoutRedirectUri: string): Promise<string | null>;
}

export interface IdentityRepository {
  findInternalUser(issuer: string, subject: string): Promise<string | null>;
  createLinkedUser(identity: VerifiedExternalIdentity): Promise<string>;
  // Privileged linking requires authenticated re-verification, never email match.
}
