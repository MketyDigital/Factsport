import postgres from 'postgres';

interface Env {
  FACTSPORT_HYPERDRIVE: { connectionString: string };
  FACTSPORT_PROBE_TOKEN?: string;
}

export default {
  async fetch(request: Request, env: Env) {
    const path = new URL(request.url).pathname;
    if (request.method !== 'GET' || path !== '/__internal/reader-check') {
      return new Response('Not found', { status: 404 });
    }
    // The temporary Worker endpoint has no write capability. Require a
    // strong single-use token even for this limited health response.
    const auth = request.headers.get('Authorization') || '';
    if (!env.FACTSPORT_PROBE_TOKEN || auth !== `Bearer ${env.FACTSPORT_PROBE_TOKEN}`) {
      return new Response('Not found', { status: 404 });
    }
    const sql = postgres(env.FACTSPORT_HYPERDRIVE.connectionString,
      { max: 1, fetch_types: false, prepare: true, connect_timeout: 10 });
    try {
      const [data] = await sql`
        SELECT current_user = 'factsport_v2_reader' AS restricted_role,
          current_database() = 'factsport_v2' AS correct_database,
          has_table_privilege(current_user,'public.matches','SELECT') AS matches_readable,
          has_table_privilege(current_user,'public.matches','INSERT') AS matches_not_readonly
      `;
      const ok = data.restricted_role && data.correct_database &&
        data.matches_readable && !data.matches_not_readonly;
      return Response.json({ ok: !!ok, limitedRole: !!ok },
        { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
    } catch {
      return Response.json({ ok: false, error: 'reader_connection_failed' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } });
    } finally {
      await sql.end();
    }
  },
};
