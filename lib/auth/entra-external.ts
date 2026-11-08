import 'server-only';

import {
  EncryptJWT, createRemoteJWKSet, jwtDecrypt, jwtVerify,
  type JWTPayload,
} from 'jose';

const STATE_COOKIE = '__Host-factsport_entra_state';
const SESSION_COOKIE = '__Host-factsport_media_session';
const STATE_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 8 * 60 * 60;

type OidcMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};

type EntraState = {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
};

export type FactsportEntraSession = {
  issuer: string;
  subject: string;
  internalUserId: string;
  email: string | null;
  emailVerified: boolean;
  expiresAt: number;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required identity configuration: ${name}`);
  return value;
}

function sessionKey(): Uint8Array {
  const encoded = required('FACTSPORT_AUTH_SESSION_SECRET');
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
  if (bytes.byteLength !== 32) throw new Error('FACTSPORT_AUTH_SESSION_SECRET must be a base64url-encoded 32-byte key');
  return bytes;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/admin';
  const parsed = new URL(value, 'https://factsport.invalid');
  if (parsed.origin !== 'https://factsport.invalid') return '/admin';
  return parsed.pathname + parsed.search + parsed.hash;
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

async function discovery(): Promise<OidcMetadata> {
  const discoveryUrl = new URL(required('ENTRA_EXTERNAL_DISCOVERY_URL'));
  if (discoveryUrl.protocol !== 'https:') throw new Error('Entra discovery URL must use HTTPS');
  const response = await fetch(discoveryUrl, { cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Entra discovery failed with HTTP ${response.status}`);
  const metadata = await response.json() as OidcMetadata;
  const expectedIssuer = required('ENTRA_EXTERNAL_ISSUER');
  if (metadata.issuer !== expectedIssuer || !metadata.authorization_endpoint ||
      !metadata.token_endpoint || !metadata.jwks_uri) {
    throw new Error('Entra discovery metadata does not match the configured issuer or required endpoints');
  }
  for (const endpoint of [metadata.authorization_endpoint, metadata.token_endpoint, metadata.jwks_uri]) {
    if (new URL(endpoint).protocol !== 'https:') throw new Error('Entra OIDC endpoints must use HTTPS');
  }
  return metadata;
}

export async function createEntraAuthorization(requestUrl: URL) {
  const metadata = await discovery();
  const clientId = required('ENTRA_EXTERNAL_CLIENT_ID');
  const redirectUri = required('ENTRA_EXTERNAL_REDIRECT_URI');
  const configuredRedirect = new URL(redirectUri);
  if (configuredRedirect.protocol !== 'https:' || configuredRedirect.href !== new URL('/api/auth/entra/callback', requestUrl.origin).href) {
    throw new Error('Configured Entra callback must exactly match this host callback URL');
  }

  const state = base64url(randomBytes(32));
  const nonce = base64url(randomBytes(32));
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const returnTo = safeReturnTo(requestUrl.searchParams.get('returnTo'));

  const stateCookie = await new EncryptJWT({ state, nonce, verifier, returnTo } satisfies EntraState)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_SECONDS}s`)
    .encrypt(sessionKey());

  const authorization = new URL(metadata.authorization_endpoint);
  authorization.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    response_mode: 'query',
    redirect_uri: redirectUri,
    scope: 'openid profile email',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();

  return { authorizationUrl: authorization.toString(), stateCookie };
}

export async function completeEntraCallback(input: {
  requestUrl: URL;
  code: string;
  state: string;
  stateCookie: string | undefined;
}) {
  if (!input.stateCookie || !input.code || !input.state) throw new Error('Missing OIDC callback state');
  if (input.code.length > 8192 || input.state.length > 512 || input.stateCookie.length > 16384) {
    throw new Error('OIDC callback parameters exceed the accepted size limits');
  }
  const { payload } = await jwtDecrypt(input.stateCookie, sessionKey(), { clockTolerance: 5 });
  const stored = payload as JWTPayload & EntraState;
  if (typeof stored.state !== 'string' || stored.state !== input.state ||
      typeof stored.nonce !== 'string' || typeof stored.verifier !== 'string' ||
      typeof stored.returnTo !== 'string') throw new Error('OIDC state validation failed');

  const metadata = await discovery();
  const clientId = required('ENTRA_EXTERNAL_CLIENT_ID');
  const redirectUri = required('ENTRA_EXTERNAL_REDIRECT_URI');
  const configuredRedirect = new URL(redirectUri);
  if (configuredRedirect.href !== new URL('/api/auth/entra/callback', input.requestUrl.origin).href) {
    throw new Error('OIDC callback host mismatch');
  }

  const tokenResponse = await fetch(metadata.token_endpoint, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code: input.code,
      redirect_uri: redirectUri,
      code_verifier: stored.verifier,
    }),
  });
  if (!tokenResponse.ok) throw new Error(`Entra token exchange failed with HTTP ${tokenResponse.status}`);
  const tokens = await tokenResponse.json() as { id_token?: string };
  if (!tokens.id_token) throw new Error('Entra did not return an ID token');

  const jwks = createRemoteJWKSet(new URL(metadata.jwks_uri));
  const verified = await jwtVerify(tokens.id_token, jwks, {
    issuer: metadata.issuer,
    audience: clientId,
    algorithms: ['RS256'],
    requiredClaims: ['iss', 'sub', 'aud', 'exp', 'iat', 'nonce'],
    clockTolerance: 5,
  });
  const claims = verified.payload;
  if (claims.nonce !== stored.nonce || typeof claims.sub !== 'string' || !claims.sub) {
    throw new Error('Entra ID token nonce or subject validation failed');
  }
  if (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== clientId) {
    throw new Error('Entra ID token authorized-party validation failed');
  }

  const email = typeof claims.email === 'string' ? claims.email :
    typeof claims.preferred_username === 'string' ? claims.preferred_username : null;
  const emailVerified = claims.email_verified === true;
  const identity = { issuer: metadata.issuer, subject: claims.sub };
  const internalUserId = await findLinkedFactsportUser(identity.issuer, identity.subject);
  if (!internalUserId) throw new Error('This Entra identity is not linked to an existing Factsport account. Contact a Factsport administrator.');

  const expiresAt = Math.min(
    typeof claims.exp === 'number' ? claims.exp : Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  );
  const session = await new EncryptJWT({
    issuer: identity.issuer,
    subject: identity.subject,
    internalUserId,
    email,
    emailVerified,
  })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .encrypt(sessionKey());

  return {
    session,
    expiresAt,
    returnTo: safeReturnTo(stored.returnTo),
  };
}

async function findLinkedFactsportUser(issuer: string, subject: string): Promise<string | null> {
  const { withFactsportEditorialPostgres } = await import('@/lib/adapters/postgres-client');
  const rows = await withFactsportEditorialPostgres(sql => sql`
    SELECT user_id
    FROM public.external_identities
    WHERE issuer = ${issuer} AND subject = ${subject}
    LIMIT 2
  `);
  if (rows.length !== 1 || typeof rows[0].user_id !== 'string') return null;
  return rows[0].user_id;
}

export async function readFactsportEntraSession(value: string | undefined): Promise<FactsportEntraSession | null> {
  if (!value) return null;
  try {
    const { payload } = await jwtDecrypt(value, sessionKey(), { clockTolerance: 5 });
    if (typeof payload.issuer !== 'string' || typeof payload.subject !== 'string' ||
        typeof payload.internalUserId !== 'string' || typeof payload.exp !== 'number') return null;
    return {
      issuer: payload.issuer,
      subject: payload.subject,
      internalUserId: payload.internalUserId,
      email: typeof payload.email === 'string' ? payload.email : null,
      emailVerified: payload.emailVerified === true,
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
}

export const entraCookieNames = { state: STATE_COOKIE, session: SESSION_COOKIE };
export const entraCookieOptions = { state: cookieOptions(STATE_TTL_SECONDS), session: cookieOptions(SESSION_TTL_SECONDS) };
