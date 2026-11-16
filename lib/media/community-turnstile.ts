import 'server-only';
import { env } from 'cloudflare:workers';

type SiteverifyResult = {
  success?: boolean;
  hostname?: string;
  action?: string;
  'error-codes'?: string[];
};

/**
 * Cloudflare Turnstile challenge for public account-free Media writes.
 * Every token is validated server-side; no client-only verification bypass.
 * Do not store the token, remote IP or private secret in the database.
 */
export async function verifyMediaCommunityTurnstile(
  request: Request,
  token: unknown,
  expectedAction: 'media-chat' | 'media-motm',
): Promise<boolean> {
  if (typeof token !== 'string' || !token.trim() || token.length > 2048) return false;
  const bindings = env as unknown as Record<string, unknown>;
  const secret = bindings.FACTSPORT_MEDIA_TURNSTILE_SECRET;
  if (typeof secret !== 'string' || secret.length < 20) return false;

  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', token);
  const remoteIp = request.headers.get('cf-connecting-ip');
  if (remoteIp && remoteIp.length <= 64) form.set('remoteip', remoteIp);

  try {
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      cache: 'no-store',
      signal: AbortSignal.timeout(4500),
    });
    if (!result.ok) return false;
    const data = await result.json() as SiteverifyResult;
    const expectedHost = new URL(request.url).hostname.toLowerCase();
    return data.success === true &&
      typeof data.hostname === 'string' &&
      data.hostname.toLowerCase() === expectedHost &&
      data.action === expectedAction;
  } catch {
    return false;
  }
}
