const encoder = new TextEncoder();
const MAX_TTL_SECONDS = 12 * 60 * 60;
const BASE64URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

function encodeBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').split('=')[0];
}

function decodeBase64Url(value) {
  if (typeof value !== 'string' || !value ||
      Array.from(value).some(character => !BASE64URL_CHARS.includes(character))) {
    throw new Error('Invalid base64url');
  }
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function importSigningKey(secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Vault signing secret unavailable');
  return globalThis.crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  );
}

export async function issueAdminVaultToken(userId, secret, nowMs = Date.now(), ttlSeconds = MAX_TTL_SECONDS) {
  if (typeof userId !== 'string' || !userId || userId.length > 256 ||
      !Number.isFinite(nowMs) || !Number.isInteger(ttlSeconds) || ttlSeconds < 60 ||
      ttlSeconds > MAX_TTL_SECONDS) throw new Error('Invalid vault token input');
  const now = Math.floor(nowMs / 1000);
  const nonce = encodeBase64Url(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  const payload = encodeBase64Url(encoder.encode(JSON.stringify({
    sub: userId, iat: now, exp: now + ttlSeconds, nonce,
  })));
  const key = await importSigningKey(secret);
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return payload + '.' + encodeBase64Url(new Uint8Array(signature));
}

export async function verifyAdminVaultToken(token, userId, secret, nowMs = Date.now()) {
  try {
    if (typeof token !== 'string' || token.length > 4096 || typeof userId !== 'string' ||
        !userId || !Number.isFinite(nowMs)) return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const payloadBytes = decodeBase64Url(parts[0]);
    const signature = decodeBase64Url(parts[1]);
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    const now = Math.floor(nowMs / 1000);
    if (payload?.sub !== userId || !Number.isInteger(payload.iat) ||
        !Number.isInteger(payload.exp) || typeof payload.nonce !== 'string' ||
        payload.iat > now + 60 || payload.exp <= now ||
        payload.exp <= payload.iat || payload.exp - payload.iat > MAX_TTL_SECONDS) return false;
    const key = await importSigningKey(secret);
    return globalThis.crypto.subtle.verify('HMAC', key, signature, encoder.encode(parts[0]));
  } catch {
    return false;
  }
}
