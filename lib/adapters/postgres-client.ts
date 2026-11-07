/**
 * Request-scoped PostgreSQL client for Cloudflare Hyperdrive.
 * Hyperdrive owns the connection pool. Never cache a postgres.js client in
 * module scope or reuse it across Worker requests: that can retain stale I/O
 * contexts after an isolate is reused.
 */
import 'server-only';
import postgres from 'postgres';
import { env } from 'cloudflare:workers';

type FactsportSql = ReturnType<typeof postgres>;

export async function withFactsportPostgres<T>(
  operation: (sql: FactsportSql) => Promise<T> | T
): Promise<T> {
  const hyperdriveUrl = env?.FACTSPORT_HYPERDRIVE?.connectionString;
  const directUrl = process.env.DATABASE_URL;
  const connectionString = hyperdriveUrl || directUrl;
  if (!connectionString) throw new Error('Factsport PostgreSQL connection is not configured');

  const sql = postgres(connectionString, {
    ...(hyperdriveUrl ? {} : { ssl: 'require' as const }),
    max: 1,
    fetch_types: false,
    prepare: true,
    connect_timeout: 10,
    idle_timeout: 5,
  });

  try {
    return await operation(sql);
  } finally {
    // Closing the request-scoped client returns its connection to Hyperdrive's
    // managed pool; it does not close the underlying pooled database session.
    await sql.end({ timeout: 1 });
  }
}
