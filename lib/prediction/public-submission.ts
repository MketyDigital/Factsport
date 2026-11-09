import 'server-only';

export const FACTSPORT_PREDICTION_VISITOR_COOKIE = '__Secure-factsport_prediction_visitor';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function readPredictionVisitorToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || '';
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== FACTSPORT_PREDICTION_VISITOR_COOKIE) continue;
    const value = part.slice(separator + 1).trim();
    return TOKEN_PATTERN.test(value) ? value : null;
  }
  return null;
}

export function createPredictionVisitorToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

export async function keyedPredictionHash(secret: string, value: string): Promise<string> {
  const keyBytes = decodeBase64Url(secret);
  if (keyBytes.byteLength !== 32) throw new Error('Prediction rate-limit secret must be a base64url-encoded 32-byte key');
  const key = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
  return Array.from(signature, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function isAllowedPredictionPublicHost(url: URL, environment: string, configuredHost: string): boolean {
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  if (environment === 'staging') {
    return /^factsport-v2-staging\.[a-z0-9-]+\.workers\.dev$/i.test(host);
  }
  return environment === 'production' && Boolean(configuredHost) &&
    host === configuredHost.trim().toLowerCase();
}

export function predictionVisitorCookieOptions(host: string, environment: string) {
  const options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax';
    path: string;
    maxAge: number;
    domain?: string;
  } = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  };
  // Same-browser claim continuity on predict.factsport.com requires the
  // parent-domain cookie; staging remains host-only.
  if (environment === 'production' && (host === 'factsport.com' || host.endsWith('.factsport.com'))) {
    options.domain = '.factsport.com';
  }
  return options;
}
