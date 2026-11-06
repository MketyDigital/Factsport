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
          has_table_privilege(current_user,'public.matches','INSERT') AS can_insert_matches,
          has_table_privilege(current_user,'public.matches','UPDATE') AS can_update_matches,
          has_table_privilege(current_user,'public.matches','DELETE') AS can_delete_matches,
          has_column_privilege(current_user,'public.matches','home_score','INSERT') AS can_insert_score,
          has_column_privilege(current_user,'public.matches','home_score','UPDATE') AS can_update_score,
          has_table_privilege(current_user,'public.app_users','SELECT') AS can_read_users,
          has_table_privilege(current_user,'public.external_identities','SELECT') AS can_read_identities,
          has_table_privilege(current_user,'public.job_runs','SELECT') AS can_read_jobs,
          (SELECT rolinherit FROM pg_roles WHERE rolname = current_user) AS inherits_roles,
          (SELECT rolconnlimit FROM pg_roles WHERE rolname = current_user) AS connection_limit
      `;
      const ok = data.restricted_role && data.correct_database && data.matches_readable &&
        !data.can_insert_matches && !data.can_update_matches && !data.can_delete_matches &&
        !data.can_insert_score && !data.can_update_score && !data.can_read_users &&
        !data.can_read_identities && !data.can_read_jobs && !data.inherits_roles &&
        Number(data.connection_limit) === 5;
      return Response.json({ ok: !!ok, limitedRole: !!ok, noRoleInheritance: !data.inherits_roles,
        connectionLimit: Number(data.connection_limit), cannotWriteMatches: !data.can_insert_matches &&
          !data.can_update_matches && !data.can_delete_matches && !data.can_insert_score && !data.can_update_score },
        { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
    } catch {
      return Response.json({ ok: false, error: 'reader_connection_failed' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } });
    } finally {
      await sql.end();
    }
  },
};
