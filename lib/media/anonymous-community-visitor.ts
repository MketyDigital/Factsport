import 'server-only';
import { env } from 'cloudflare:workers';

const COOKIE_NAME = '__Host-factsport_media_visitor';
const DEV_COOKIE_NAME = 'factsport_media_visitor_dev';
const encoder = new TextEncoder();
const B64URL = /^[a-zA-Z0-9_-]+$/;

function base64url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromBase64url(value: string) {
  const text = atob(value.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(text, c => c.charCodeAt(0));
}
function hex(bytes: Uint8Array) {
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function sha256(value: string) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}
async function signingKey() {
  const bindings = env as unknown as Record<string, unknown>;
  const secret = bindings.FACTSPORT_MEDIA_VISITOR_SECRET;
  const key = typeof secret === 'string' ? secret : '';
  if (key.length < 48) throw new Error('Media visitor signing secret is not configured');
  return crypto.subtle.importKey(
    'raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  );
}
async function signature(nonce: string) {
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', await signingKey(), encoder.encode('media-v1:' + nonce))));
}

export type CommunityVisitor = { tokenHash: string; networkHash: string; setCookie?: string };

/**
 * A signed random browser identity, not a personal account or proof of a unique
 * human. Signing prevents forged identities; cookie resets still require
 * independent network throttling and additional abuse controls.
 */
export async function anonymousCommunityVisitor(request: Request): Promise<CommunityVisitor> {
  const url = new URL(request.url);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid request');
  // Require a same-origin browser write. SameSite alone is not a CSRF control.
  const origin = request.headers.get('origin');
  if (!origin || origin !== url.origin ||
      !['same-origin', 'none', null].includes(request.headers.get('sec-fetch-site'))) {
    throw new Error('Cross-origin community submission rejected');
  }
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) throw new Error('Invalid content type');
  // On Cloudflare this request header is set by the edge. Do not accept
  // untrusted X-Forwarded-For for rate limiting.
  const ip = request.headers.get('cf-connecting-ip');
  if (!ip || ip.length > 64 || !/^[0-9a-fA-F:.]+$/.test(ip)) {
    throw new Error('Verified network identity required');
  }
  const bindings = env as unknown as Record<string, unknown>;
  const pepper = bindings.FACTSPORT_MEDIA_NETWORK_PEPPER;
  if (typeof pepper !== 'string' || pepper.length < 48) {
    throw new Error('Media network protection is not configured');
  }
  // Daily-scoped pseudonymous network hash: not stored as an IP address.
  const day = new Date().toISOString().slice(0, 10);
  const networkHash = await sha256(pepper + '|media-network|' + day + '|' + ip);
  const name = url.protocol === 'https:' ? COOKIE_NAME : DEV_COOKIE_NAME;
  const cookie = request.headers.get('cookie') || '';
  const raw = cookie.split(';').map(part => part.trim())
    .find(part => part.startsWith(name + '='))?.slice(name.length + 1) || '';
  let nonce: string | null = null;
  const segments = raw.split('.');
  if (segments.length === 2 && segments[0].length === 43 &&
      segments[1].length === 43 && segments.every(part => B64URL.test(part))) {
    try {
      const valid = await crypto.subtle.verify(
        'HMAC', await signingKey(), fromBase64url(segments[1]),
        encoder.encode('media-v1:' + segments[0]),
      );
      if (valid) nonce = segments[0];
    } catch {
      // Issue a fresh anonymous browser identity, not a trusted user identity.
    }
  }
  if (!nonce) {
    nonce = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const signed = await signature(nonce);
    return {
      tokenHash: await sha256('factsport-media-v1:' + nonce),
      networkHash,
      setCookie: name + '=' + nonce + '.' + signed +
        '; Path=/; HttpOnly; SameSite=Lax; Max-Age=15552000' +
        (url.protocol === 'https:' ? '; Secure' : ''),
    };
  }
  return { tokenHash: await sha256('factsport-media-v1:' + nonce), networkHash };
}

/** Verify a returning anonymous visitor without issuing a new identity on GET. */
export async function existingAnonymousMediaTokenHash(request: Request): Promise<string | null> {
  const url = new URL(request.url);
  const name = url.protocol === 'https:' ? COOKIE_NAME : DEV_COOKIE_NAME;
  const raw = (request.headers.get('cookie') || '').split(';')
    .map(part => part.trim()).find(part => part.startsWith(name + '='))
    ?.slice(name.length + 1) || '';
  const [nonce, mac, ...extra] = raw.split('.');
  if (extra.length || !nonce || !mac || nonce.length !== 43 || mac.length !== 43 ||
      !B64URL.test(nonce) || !B64URL.test(mac)) return null;
  try {
    const signatureValid = await crypto.subtle.verify(
      'HMAC', await signingKey(), fromBase64url(mac), encoder.encode('media-v1:' + nonce),
    );
    return signatureValid ? sha256('factsport-media-v1:' + nonce) : null;
  } catch {
    return null;
  }
}

/**
 * Bootstrap a returning or new anonymous session on a same-origin GET before
 * accepting voting. This avoids two tabs independently minting visitor IDs
 * during simultaneous first votes. A cookie is not proof of one human.
 */
export async function ensureAnonymousMediaSession(request: Request) {
  const existing = await existingAnonymousMediaTokenHash(request);
  if (existing) return { tokenHash: existing };
  const url = new URL(request.url);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid session origin');
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const mac = await signature(nonce);
  const name = url.protocol === 'https:' ? COOKIE_NAME : DEV_COOKIE_NAME;
  return {
    tokenHash: await sha256('factsport-media-v1:' + nonce),
    setCookie: name + '=' + nonce + '.' + mac +
      '; Path=/; HttpOnly; SameSite=Lax; Max-Age=15552000' +
      (url.protocol === 'https:' ? '; Secure' : ''),
  };
}
