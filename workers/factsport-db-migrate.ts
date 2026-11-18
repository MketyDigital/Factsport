import postgres from 'postgres';
import { FACTSPORT_MIGRATIONS } from './generated-factsport-migration-chain';

interface Env {
  FACTSPORT_HYPERDRIVE: { connectionString: string };
  FACTSPORT_MIGRATE_TOKEN?: string;
}

const CORE_RELATIONS = [
  'app_users',
  'external_identities',
  'job_runs',
  'matches',
] as const;

const CORE_COLUMNS: Record<string, string[]> = {
  app_users: ['created_at', 'id'],
  external_identities: ['created_at', 'issuer', 'subject', 'user_id'],
  job_runs: ['error_code', 'finished_at', 'job_id', 'run_key', 'started_at', 'status'],
  matches: [
    'away_logo', 'away_score', 'away_team', 'api_id', 'created_at', 'espn_id', 'h2h',
    'home_logo', 'home_score', 'home_team', 'id', 'league', 'lineups',
    'match_date', 'match_events', 'match_group', 'points_distributed',
    'predictor', 'referees', 'source', 'source_updated_at', 'stage', 'stats',
    'status', 'updated_at', 'venue', 'version',
  ],
};

const ROLE_SEED_SQL = `DO $roles$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'factsport_v2_editorial_writer',
    'factsport_v2_media_automation_writer',
    'factsport_v2_social_dispatcher',
    'factsport_v2_media_broadcast_admin',
    'factsport_v2_broadcast_token_issuer',
    'factsport_v2_media_access_admin',
    'factsport_v2_prediction_api'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'CREATE ROLE %I NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
        role_name
      );
    END IF;
  END LOOP;
END;
$roles$;`;

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

function sanitizedSqlState(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code ?? '') : '';
  return /^[A-Z0-9]{5}$/.test(code) ? code : 'none';
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST' ||
        new URL(request.url).pathname !== '/__internal/factsport-migrate') {
      return new Response('Not found', { status: 404 });
    }
    const auth = request.headers.get('Authorization') || '';
    if (!(await tokenMatches(
      env.FACTSPORT_MIGRATE_TOKEN || '',
      auth.startsWith('Bearer ') ? auth.slice(7) : '',
    ))) return new Response('Not found', { status: 404 });

    if (FACTSPORT_MIGRATIONS.length === 0 ||
        FACTSPORT_MIGRATIONS.some((migration, index) => migration.version !== index)) {
      return Response.json({ ok: false, error: 'migration_bundle_invalid' }, {
        status: 500, headers: { 'Cache-Control': 'no-store' },
      });
    }
    const connectionString = env.FACTSPORT_HYPERDRIVE?.connectionString;
    if (!connectionString) {
      return Response.json({ ok: false, error: 'hyperdrive_missing' }, {
        status: 503, headers: { 'Cache-Control': 'no-store' },
      });
    }

    const sql = postgres(connectionString, {
      max: 1, fetch_types: false, prepare: false, connect_timeout: 10, idle_timeout: 5,
    });
    let failedVersion: number | null = null;
    try {
      const [identity] = await sql`
        SELECT current_database() AS database, current_user AS connected_as
      `;
      if (identity.database !== 'factsport_v2' || identity.connected_as !== 'mketydbadmin') {
        return Response.json({ ok: false, error: 'unexpected_database_identity' }, {
          status: 503, headers: { 'Cache-Control': 'no-store' },
        });
      }

      const relations = await sql`
        SELECT relation.relname AS object_name,
          CASE relation.relkind
            WHEN 'r' THEN 'table'
            WHEN 'p' THEN 'partitioned_table'
            WHEN 'v' THEN 'view'
            WHEN 'm' THEN 'materialized_view'
            WHEN 'f' THEN 'foreign_table'
            ELSE relation.relkind::text
          END AS object_type
        FROM pg_class relation
        JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
        ORDER BY relation.relname
      `;
      const [ledgerState] = await sql`
        SELECT to_regclass('public.factsport_schema_migrations') IS NOT NULL AS exists
      `;
      const ledgerExists = Boolean(ledgerState.exists);
      let ledgerRows: Array<{ version: number; filename: string; checksum_sha256: string }> = [];
      if (ledgerExists) {
        ledgerRows = await sql`
          SELECT version, filename, checksum_sha256
          FROM public.factsport_schema_migrations
          ORDER BY version
        `;
      }

      if (ledgerRows.length === 0) {
        const actual = relations.map((relation) => String(relation.object_name));
        const expected = [...CORE_RELATIONS, ...(ledgerExists ? ['factsport_schema_migrations'] : [])].sort();
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          return Response.json({
            ok: false, error: 'untracked_schema_drift',
            database: identity.database, connectedAs: identity.connected_as,
          }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
        }

        const actualColumns = await sql`
          SELECT table_name, column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = ANY(${CORE_RELATIONS})
          ORDER BY table_name, column_name
        `;
        const columnMap: Record<string, string[]> = {};
        for (const row of actualColumns) {
          const tableName = String(row.table_name);
          (columnMap[tableName] ??= []).push(String(row.column_name));
        }
        if (JSON.stringify(columnMap) !== JSON.stringify(CORE_COLUMNS)) {
          return Response.json({
            ok: false, error: 'untracked_core_schema_mismatch',
            database: identity.database, connectedAs: identity.connected_as,
          }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
        }
      }

      for (let index = 0; index < ledgerRows.length; index++) {
        const row = ledgerRows[index];
        const expected = FACTSPORT_MIGRATIONS[index];
        if (!expected || Number(row.version) !== index ||
            row.filename !== expected.filename ||
            String(row.checksum_sha256).trim() !== expected.checksumSha256) {
          return Response.json({
            ok: false, error: 'migration_ledger_drift',
            database: identity.database, connectedAs: identity.connected_as,
          }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
        }
      }

      if (ledgerRows.length === 0) {
        await sql.unsafe(ROLE_SEED_SQL);
      }

      let appliedCount = 0;
      for (const migration of FACTSPORT_MIGRATIONS) {
        if (migration.version < ledgerRows.length) continue;
        failedVersion = migration.version;
        await sql.begin(async (tx) => {
          await tx`SELECT pg_advisory_xact_lock(720061, 3)`;
          const [exists] = await tx`
            SELECT to_regclass('public.factsport_schema_migrations') IS NOT NULL AS present
          `;
          if (migration.version > 0 && !exists.present) {
            throw new Error('migration_ledger_missing');
          }
          if (exists.present) {
            const [record] = await tx`
              SELECT filename, checksum_sha256
              FROM public.factsport_schema_migrations
              WHERE version = ${migration.version}
            `;
            if (record) {
              if (record.filename !== migration.filename ||
                  String(record.checksum_sha256).trim() !== migration.checksumSha256) {
                throw new Error('migration_checksum_mismatch');
              }
              return;
            }
            const [latest] = await tx`
              SELECT max(version)::integer AS version
              FROM public.factsport_schema_migrations
            `;
            const next = latest.version === null ? 0 : Number(latest.version) + 1;
            if (next !== migration.version) throw new Error('migration_sequence_gap');
          } else if (migration.version !== 0) {
            throw new Error('migration_ledger_missing');
          }

          await tx.unsafe(migration.sql);
          await tx`
            INSERT INTO public.factsport_schema_migrations
              (version, filename, checksum_sha256)
            VALUES (${migration.version}, ${migration.filename}, ${migration.checksumSha256})
          `;
        });
        appliedCount++;
      }

      const [completion] = await sql`
        SELECT count(*)::integer AS applied,
          min(version)::integer AS first_version,
          max(version)::integer AS last_version
        FROM public.factsport_schema_migrations
      `;
      const complete = Number(completion.applied) === FACTSPORT_MIGRATIONS.length &&
        Number(completion.first_version) === 0 &&
        Number(completion.last_version) === FACTSPORT_MIGRATIONS.length - 1;
      return Response.json({
        ok: complete,
        database: identity.database,
        connectedAs: identity.connected_as,
        appliedCount,
        totalMigrations: FACTSPORT_MIGRATIONS.length,
        firstVersion: completion.first_version,
        lastVersion: completion.last_version,
      }, { status: complete ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return Response.json({
        ok: false,
        error: 'factsport_migration_failed',
        failedVersion,
        sqlState: sanitizedSqlState(error),
      }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    } finally {
      try { await sql.end(); } catch { /* preserve the sanitized result */ }
    }
  },
};
