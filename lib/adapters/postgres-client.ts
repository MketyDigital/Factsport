/**
 * One bounded PostgreSQL client per Worker isolate.
 * All server-side domain adapters share this client to respect the five-origin
 * Hyperdrive pool and avoid multiplying connections per request path.
 */
import 'server-only';
import postgres from 'postgres';
import { env } from 'cloudflare:workers';

let client: ReturnType<typeof postgres> | undefined;

export function getFactsportPostgres() {
  if (client) return client;

  const hyperdriveUrl = env?.FACTSPORT_HYPERDRIVE?.connectionString;
  const directUrl = process.env.DATABASE_URL;

  if (hyperdriveUrl) {
    client = postgres(hyperdriveUrl, {
      max: 1,
      fetch_types: false,
      prepare: true,
      idle_timeout: 5,
      connect_timeout: 10,
    });
  } else if (directUrl) {
    // Direct TLS is for explicitly configured non-Worker verification only.
    client = postgres(directUrl, {
      ssl: 'require',
      max: 1,
      fetch_types: false,
      prepare: true,
      idle_timeout: 5,
      connect_timeout: 10,
    });
  } else {
    throw new Error('Factsport PostgreSQL connection is not configured');
  }

  return client;
}
