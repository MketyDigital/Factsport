import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { withFactsportPostgres } from '@/lib/adapters/postgres-client';

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

  try {
    const inventory = await withFactsportPostgres(async sql => {
      const [server] = await sql`
        SELECT current_database() AS database_name,
               current_user AS connected_role,
               (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS tls_enabled
      `;
      const [tables] = await sql`
        SELECT
          to_regclass('public.external_identities') IS NOT NULL AS external_identities,
          to_regclass('public.media_editorial_memberships') IS NOT NULL AS media_editorial_memberships
      `;
      const rolesToCheck = [
        'factsport_v2_public_reader',
        'factsport_v2_editorial_writer',
        'factsport_v2_prediction_api',
        'factsport_v2_social_dispatcher',
        'factsport_v2_broadcast_admin',
        'factsport_v2_broadcast_token_issuer',
      ];
      const roles = await sql`
        SELECT rolname, rolsuper, rolcreaterole, rolcreatedb
        FROM pg_roles
        WHERE rolname = ANY(${rolesToCheck})
        ORDER BY rolname
      `;
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

    const ok = inventory.targetDatabaseMatches && inventory.tlsEnabled;
    return NextResponse.json({ ...inventory, ok }, {
      status: ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({
      ok: false,
      error: 'factsport_staging_database_preflight_unavailable',
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
