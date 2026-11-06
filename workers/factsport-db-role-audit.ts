interface Env {
  FACTSPORT_HYPERDRIVE: { connectionString: string };
  FACTSPORT_AUDIT_TOKEN?: string;
}

async function tokenMatches(expected: string, provided: string): Promise<boolean> {
  if (!expected || !provided || expected.length > 4096 || provided.length > 4096) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
  ]);
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left[i] ^ right[i];
  return mismatch === 0;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (request.method !== 'GET' || url.pathname !== '/__internal/db-role-audit') {
        return new Response('Not found', { status: 404 });
      }
      const auth = request.headers.get('Authorization') || '';
      const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!(await tokenMatches(env.FACTSPORT_AUDIT_TOKEN || '', provided))) {
        return new Response('Not found', { status: 404 });
      }
      return Response.json({ ok: true, worker: 'factsport-v2-db-role-audit', hyperdriveBindingPresent: !!env.FACTSPORT_HYPERDRIVE?.connectionString },
        { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      const name = error && typeof error === 'object' && 'name' in error
        ? String((error as { name?: unknown }).name) : 'unknown';
      return Response.json({ ok: false, error: 'audit_worker_unhandled', errorName: name },
        { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }
  },
};
