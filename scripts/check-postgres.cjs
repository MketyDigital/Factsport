// Read-only staging smoke test. Never prints credentials or individual user data.
const postgres = require('postgres');
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL missing'); process.exit(2); }
const sql = postgres(url, { ssl: 'require', max: 1, connect_timeout: 10 });
(async () => {
  try {
    const [row] = await sql`select current_database() as database, current_setting('server_version') as version`;
    if (row.database !== 'factsport_v2') throw new Error('Connected to unexpected database');
    const [tables] = await sql`
      SELECT count(*)::integer AS total FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('matches', 'app_users', 'external_identities', 'job_runs')
    `;
    console.log(JSON.stringify({ ok: true, database: row.database, version: row.version, coreTablesFound: tables.total }));
  } catch (err) {
    console.error('PostgreSQL check failed:', err.code || err.name || 'unknown');
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
})();
