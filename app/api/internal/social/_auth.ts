import { env } from 'cloudflare:workers';

export async function isSocialDispatcherRequestAuthorized(request: Request): Promise<boolean> {
  const bindings = env as unknown as Record<string, unknown>;
  if (bindings.FACTSPORT_SOCIAL_DISPATCH_READY !== 'true') return false;
  const hyperdrive = bindings.FACTSPORT_SOCIAL_DISPATCHER_HYPERDRIVE as { connectionString?: string } | undefined;
  if (!hyperdrive?.connectionString) return false;
  const expected = typeof bindings.FACTSPORT_SOCIAL_DISPATCH_TOKEN === 'string'
    ? bindings.FACTSPORT_SOCIAL_DISPATCH_TOKEN : '';
  const authorization = request.headers.get('authorization') || '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (expected.length < 32 || !supplied || expected.length > 4096 || supplied.length > 4096) return false;
  const encoder = new TextEncoder();
  const [expectedHash, suppliedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    crypto.subtle.digest('SHA-256', encoder.encode(supplied)),
  ]);
  const a = new Uint8Array(expectedHash);
  const b = new Uint8Array(suppliedHash);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}
