const API = 'https://api.cloudflare.com/client/v4';

function streamConfig() {
  return {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    apiToken: process.env.CLOUDFLARE_STREAM_API_TOKEN || '',
    signingKeyId: process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID || '',
    signingKeyPem: process.env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM || '',
    allowedOrigins: (process.env.FACTSPORT_STREAM_ALLOWED_ORIGINS || 'factsport.com,www.factsport.com')
      .split(',').map(value => value.trim().toLowerCase()).filter(Boolean),
  };
}

export function isFactsportStreamVideoReady(): boolean {
  const config = streamConfig();
  return process.env.FACTSPORT_STREAM_VIDEO_READY === 'true' &&
    /^[a-f0-9]{32}$/i.test(config.accountId) &&
    config.apiToken.length >= 32 &&
    /^[a-f0-9]{32}$/i.test(config.signingKeyId) &&
    config.signingKeyPem.includes('BEGIN PRIVATE KEY') &&
    config.allowedOrigins.length > 0 &&
    config.allowedOrigins.every(origin => /^(?:[a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]{2,}$/.test(origin));
}

function requireConfig() {
  if (!isFactsportStreamVideoReady()) throw new Error('Cloudflare Stream video ingestion is not provisioned.');
  return streamConfig();
}

async function streamRequest(path: string, init: RequestInit = {}) {
  const config = requireConfig();
  const response = await fetch(API + '/accounts/' + config.accountId + '/stream' + path, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + config.apiToken,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
    signal: init.signal || AbortSignal.timeout(20000),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as any;
  if (!response.ok || payload?.success !== true || !payload?.result) {
    const code = Array.isArray(payload?.errors) ? String(payload.errors[0]?.code || 'unknown') : 'unknown';
    throw new Error('Cloudflare Stream request failed (' + code + ').');
  }
  return payload.result;
}

export function factsportStreamAllowedOrigins() {
  return requireConfig().allowedOrigins;
}

export async function createFactsportStreamDirectUpload(input: {
  assetId: string; title: string; creatorId: string; maxDurationSeconds?: number;
}) {
  const config = requireConfig();
  const result = await streamRequest('/direct_upload', {
    method: 'POST',
    body: JSON.stringify({
      maxDurationSeconds: input.maxDurationSeconds || 900,
      allowedOrigins: config.allowedOrigins,
      creator: input.creatorId.slice(0, 64),
      expiry: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      meta: { factsportMediaVideoId: input.assetId, title: input.title.slice(0, 200) },
      requireSignedURLs: true,
      thumbnailTimestampPct: 0.1,
    }),
  });
  const uploadURL = typeof result.uploadURL === 'string' ? result.uploadURL : '';
  const uid = typeof result.uid === 'string' ? result.uid : '';
  if (!uploadURL.startsWith('https://') || !/^[a-f0-9]{32}$/i.test(uid)) {
    throw new Error('Cloudflare Stream returned an invalid direct-upload response.');
  }
  return { uploadURL, uid, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() };
}

export async function getFactsportStreamVideo(uid: string) {
  if (!/^[a-f0-9]{32}$/i.test(uid)) throw new Error('Invalid Stream video identifier.');
  return streamRequest('/' + uid, { method: 'GET' });
}

export async function deleteFactsportStreamVideo(uid: string) {
  if (!/^[a-f0-9]{32}$/i.test(uid)) return;
  const config = requireConfig();
  const response = await fetch(API + '/accounts/' + config.accountId + '/stream/' + uid, {
    method: 'DELETE', headers: { Authorization: 'Bearer ' + config.apiToken, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000), cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as any;
  if (!response.ok || payload?.success !== true) throw new Error('Cloudflare Stream cleanup failed.');
}

export function getFactsportStreamPlaybackHost(playbackUrl: unknown): string {
  if (typeof playbackUrl !== 'string') throw new Error('Cloudflare Stream playback URL is missing.');
  const url = new URL(playbackUrl);
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.cloudflarestream\.com$/i.test(url.hostname)) {
    throw new Error('Cloudflare Stream returned an invalid playback host.');
  }
  return url.hostname;
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pemBytes(pem: string) {
  const encoded = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = atob(encoded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

export async function createFactsportStreamSignedToken(): Promise<string> {
  const config = requireConfig();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', kid: config.signingKeyId })));
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    kid: config.signingKeyId, exp: now + 60 * 60, nbf: now - 30,
  })));
  const signingInput = header + '.' + payload;
  const key = await crypto.subtle.importKey(
    'pkcs8', pemBytes(config.signingKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput),
  ));
  return signingInput + '.' + base64Url(signature);
}
