import { cookies } from 'next/headers';
import { createClient } from '@/app/lib/supabase/server';
import { issueAdminVaultToken, verifyAdminVaultToken } from '@/lib/admin-vault-token.mjs';

export const ADMIN_EMAILS = [
  'mkposcosunday@gmail.com',
  'factsportlive@gmail.com',
  'fact@factsport.com',
];
const VAULT_COOKIE = 'admin_vault_unlocked';
const VAULT_TTL_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const aa = new Uint8Array(a), bb = new Uint8Array(b);
  let mismatch = 0;
  for (let i = 0; i < aa.length; i++) mismatch |= aa[i] ^ bb[i];
  return mismatch === 0;
}

export async function getAuthenticatedAdmin(): Promise<{ id: string; email: string } | null> {
  try {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user?.id || !user.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) return null;
    const { data: profile, error: profileError } = await supabase
      .from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profileError || profile?.role !== 'admin') return null;
    return { id: user.id, email: user.email };
  } catch {
    return null;
  }
}

export async function isAdminVaultUnlocked(userId: string): Promise<boolean> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = cookies().get(VAULT_COOKIE)?.value;
  if (!secret || !token || !userId) return false;
  return verifyAdminVaultToken(token, userId, secret);
}

export type AdminAuthorization =
  | { ok: true; user: { id: string; email: string } }
  | { ok: false; status: 401 | 403; error: string };

export async function authorizeAdminAction(): Promise<AdminAuthorization> {
  const user = await getAuthenticatedAdmin();
  if (!user) return { ok: false, status: 403, error: 'Authenticated administrator required.' };
  if (!(await isAdminVaultUnlocked(user.id))) {
    return { ok: false, status: 401, error: 'Admin vault is locked. Unlock it and retry.' };
  }
  return { ok: true, user };
}

export async function unlockAdminVault(pin: string) {
  const user = await getAuthenticatedAdmin();
  if (!user) return { success: false, error: 'Authenticated administrator required.' };
  const expectedPin = process.env.ADMIN_PIN;
  const signingSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!expectedPin || !signingSecret) {
    return { success: false, error: 'System configuration error. Vault sealed.' };
  }
  if (typeof pin !== 'string' || pin.length < 1 || pin.length > 128 ||
      !(await constantTimeEqual(expectedPin, pin))) {
    return { success: false, error: 'Incorrect PIN.' };
  }
  const token = await issueAdminVaultToken(user.id, signingSecret, Date.now(), VAULT_TTL_SECONDS);
  cookies().set(VAULT_COOKIE, token, {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: VAULT_TTL_SECONDS,
  });
  return { success: true };
}

export async function isCronRequest(request: Request): Promise<boolean> {
  const secret = process.env.CRON_KEY;
  const authorization = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!secret || secret.length < 32 || !match || match[1].length > 4096) return false;
  return constantTimeEqual(secret, match[1]);
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
