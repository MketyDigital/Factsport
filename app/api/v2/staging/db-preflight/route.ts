import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { getFactsportEditorialPostgresReadiness, withFactsportPostgres } from '@/lib/adapters/postgres-client';
import { getPostgresMatchById, getPostgresMatchPlaybackById, getPostgresTeamForm } from '@/lib/adapters/postgres-matches';
import { getExternalData } from '@/app/lib/matchService';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * CI-only, read-only database inventory over the staging Worker's Hyperdrive.
 * Middleware requires the short-lived staging token; production always returns
 * 404. No row data, connection strings, hostnames, or credentials are returned.
 */
export async function GET() {
  if (env.FACTSPORT_ENVIRONMENT !== 'staging') {
    return new NextResponse('Not found', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  let phase = 'server_identity';
  try {
    const inventory = await withFactsportPostgres(async sql => {
      const [server] = await sql`
        SELECT current_database() AS database_name,
               current_user AS connected_role,
               (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS tls_enabled
      `;
      phase = 'media_table_inventory';
      const [tables] = await sql`
        SELECT
          to_regclass('public.external_identities') IS NOT NULL AS external_identities,
          to_regclass('public.media_editorial_memberships') IS NOT NULL AS media_editorial_memberships
      `;
      const rolesToCheck = [
        'factsport_v2_reader',
        'factsport_v2_schedule_writer',
        'factsport_v2_espn_writer',
        'factsport_v2_editorial_writer',
        'factsport_v2_media_automation_writer',
        'factsport_v2_social_dispatcher',
        'factsport_v2_media_broadcast_admin',
        'factsport_v2_broadcast_token_issuer',
        'factsport_v2_media_access_admin',
        'factsport_v2_prediction_api',
      ];
      phase = 'role_inventory';
      const roles = await sql`
        SELECT rolname, rolsuper, rolcreaterole, rolcreatedb
        FROM pg_roles
        WHERE rolname::text IN ${sql(rolesToCheck)}
        ORDER BY rolname
      `;
      phase = 'match_detail_reader_grants';
      const [matchDetailReader] = await sql`
        SELECT
          has_table_privilege('factsport_v2_reader', 'public.matches', 'SELECT') AS matches_readable,
          has_column_privilege('factsport_v2_reader', 'public.matches', 'legacy_match_id', 'SELECT') AS legacy_match_id_readable,
          has_column_privilege('factsport_v2_reader', 'public.matches', 'display_clock', 'SELECT') AS display_clock_readable,
          has_column_privilege('factsport_v2_reader', 'public.matches', 'provider_widget_id', 'SELECT') AS provider_widget_id_readable,
          has_table_privilege('factsport_v2_reader', 'public.public_match_pins', 'SELECT') AS public_pins_readable,
          has_table_privilege('factsport_v2_reader', 'public.public_match_media', 'SELECT') AS public_media_readable
      `;
      phase = 'migration_tracking_inventory';
      const migrationTables = await sql`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_type = 'BASE TABLE'
          AND table_name ~* '(migration|schema_version)'
        ORDER BY table_schema, table_name
      `;
      return {
        database: server.database_name,
        connectedRole: server.connected_role,
        tlsEnabled: server.tls_enabled === true,
        targetDatabaseMatches: server.database_name === 'factsport_v2',
        requiredMediaTables: tables,
        discoveredMigrationTrackingTables: migrationTables,
        matchDetailReader: {
          ...matchDetailReader,
          ready: Object.values(matchDetailReader || {}).every(value => value === true),
        },
        roleInventory: rolesToCheck.map(name => {
          const role = roles.find(item => item.rolname === name);
          return role ? {
            name,
            exists: true,
            superuser: role.rolsuper,
            canCreateRoles: role.rolcreaterole,
            canCreateDatabases: role.rolcreatedb,
          } : { name, exists: false };
        }),
      };
    });

    phase = 'match_detail_runtime_probe';
    let matchDetailRuntimeProbe: Record<string, unknown> = { ready: false, matchAvailable: false };
    try {
      const [candidate] = await withFactsportPostgres(sql => sql`
        SELECT id FROM public.matches ORDER BY match_date ASC, id ASC LIMIT 1
      `);
      if (candidate?.id) {
        const matchId = String(candidate.id);
        const match = await getPostgresMatchById(matchId);
        if (!match) throw new Error('match_adapter_empty');
        phase = 'match_detail_playback_query';
        await getPostgresMatchPlaybackById(matchId);
        phase = 'match_detail_home_form_query';
        await getPostgresTeamForm(String(match.home_team || ''));
        phase = 'match_detail_away_form_query';
        await getPostgresTeamForm(String(match.away_team || ''));
        phase = 'match_detail_external_enrichment';
        await getExternalData(match);
        matchDetailRuntimeProbe = { ready: true, matchAvailable: true };
      }
    } catch (cause: unknown) {
      const rawCode = cause && typeof cause === 'object' && 'code' in cause
        ? String((cause as { code?: unknown }).code || '') : '';
      const message = cause instanceof Error ? cause.message.toLowerCase() : '';
      matchDetailRuntimeProbe = {
        ready: false,
        matchAvailable: false,
        phase,
        sqlState: /^[A-Z0-9]{5}$/.test(rawCode) ? rawCode : 'none',
        errorClass: cause instanceof Error ? cause.name : 'Unknown',
        errorHint: /connection|socket|timeout|terminated|closed/.test(message) ? 'connection'
          : /permission|not allowed|denied/.test(message) ? 'permission'
          : /does not exist|undefined|relation/.test(message) ? 'schema_or_view'
          : 'query_failed',
      };
    }
    const editorialRuntime = await getFactsportEditorialPostgresReadiness();
    const ok = inventory.targetDatabaseMatches && inventory.tlsEnabled;
    const error = !ok
      ? inventory.targetDatabaseMatches ? 'tls_not_verified' : 'unexpected_database'
      : undefined;
    return NextResponse.json({ ...inventory, matchDetailRuntimeProbe, editorialRuntime, ok, error }, {
      status: ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (cause: unknown) {
    const rawCode = cause && typeof cause === 'object' && 'code' in cause
      ? String((cause as { code?: unknown }).code || '') : '';
    const sqlState = /^[A-Z0-9]{5}$/.test(rawCode) ? rawCode : 'none';
    const errorClass = cause instanceof Error ? cause.name : 'Unknown';
    const message = cause instanceof Error ? cause.message.toLowerCase() : '';
    const errorHint = /connection|socket|timeout|terminated|closed/.test(message) ? 'connection'
      : /permission|not allowed|denied/.test(message) ? 'permission'
      : /does not exist|undefined|relation/.test(message) ? 'schema_or_view'
      : 'query_failed';
    return NextResponse.json({
      ok: false,
      error: 'factsport_staging_database_preflight_unavailable',
      phase,
      sqlState,
      errorClass,
      errorHint,
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
