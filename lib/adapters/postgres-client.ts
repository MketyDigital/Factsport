/**
 * Request-scoped PostgreSQL clients for Cloudflare Hyperdrive.
 * Hyperdrive owns pooling. Never cache postgres.js clients across Worker requests.
 */
import 'server-only';
import postgres from 'postgres';
import { env } from 'cloudflare:workers';

type FactsportSql = ReturnType<typeof postgres>;

async function withConnection<T>(connectionString: string | undefined, operation: (sql: FactsportSql) => Promise<T> | T, label: string) {
  if (!connectionString) throw new Error(`${label} PostgreSQL binding is not configured`);
  const sql = postgres(connectionString, {
    max: 1, fetch_types: false, prepare: true, connect_timeout: 10, idle_timeout: 5,
  });
  try {
    return await operation(sql);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export function withFactsportPostgres<T>(operation: (sql: FactsportSql) => Promise<T> | T): Promise<T> {
  const hyperdriveUrl = env?.FACTSPORT_HYPERDRIVE?.connectionString;
  const directUrl = hyperdriveUrl ? undefined : process.env.DATABASE_URL;
  return withConnection(hyperdriveUrl || directUrl, operation, 'Factsport reader');
}

/**
 * Privileged Media CMS writer. This must be a distinct Hyperdrive binding
 * backed by factsport_v2_editorial_writer, never the read-only public binding.
 * There is deliberately no DATABASE_URL or Supabase service-role fallback.
 */
export function withFactsportEditorialPostgres<T>(operation: (sql: FactsportSql) => Promise<T> | T): Promise<T> {
  const connectionString = env?.FACTSPORT_EDITORIAL_HYPERDRIVE?.connectionString;
  return withConnection(connectionString, operation, 'Factsport editorial writer');
}
