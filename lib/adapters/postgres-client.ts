/**
 * Request-scoped PostgreSQL clients for Cloudflare Hyperdrive.
 * Hyperdrive owns pooling. Never cache postgres.js clients across Worker requests.
 */
import 'server-only';
import postgres from 'postgres';
import { env } from 'cloudflare:workers';

type FactsportSql = ReturnType<typeof postgres>;
type HyperdriveBinding = { connectionString: string };

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
  const bindings = env as unknown as Record<string, HyperdriveBinding | undefined>;
  const hyperdriveUrl = bindings.FACTSPORT_HYPERDRIVE?.connectionString;
  const directUrl = hyperdriveUrl ? undefined : process.env.DATABASE_URL;
  return withConnection(hyperdriveUrl || directUrl, operation, 'Factsport reader');
}

/**
 * Privileged Media CMS writer. This must be a distinct Hyperdrive binding
 * backed by factsport_v2_editorial_writer, never the public or sports writer.
 * There is deliberately no DATABASE_URL or Supabase service-role fallback.
 */
export function withFactsportEditorialPostgres<T>(operation: (sql: FactsportSql) => Promise<T> | T): Promise<T> {
  const bindings = env as unknown as Record<string, HyperdriveBinding | undefined>;
  return withConnection(bindings.FACTSPORT_EDITORIAL_HYPERDRIVE?.connectionString, operation, 'Factsport editorial writer');
}


/**
 * Dedicated Stream/broadcast administration identity. It cannot be substituted
 * with the editorial writer, public reader, or Prediction database connection.
 */
export function withFactsportBroadcastAdminPostgres<T>(operation: (sql: FactsportSql) => Promise<T> | T): Promise<T> {
  const bindings = env as unknown as Record<string, HyperdriveBinding | undefined>;
  return withConnection(
    bindings.FACTSPORT_BROADCAST_ADMIN_HYPERDRIVE?.connectionString,
    operation,
    'Factsport broadcast administrator',
  );
}


/** Separate token-issuer identity: no studio settings, role grants or editorial writes. */
export function withFactsportBroadcastTokenIssuerPostgres<T>(operation: (sql: FactsportSql) => Promise<T> | T): Promise<T> {
  const bindings = env as unknown as Record<string, HyperdriveBinding | undefined>;
  return withConnection(
    bindings.FACTSPORT_BROADCAST_TOKEN_HYPERDRIVE?.connectionString,
    operation,
    'Factsport broadcast token issuer',
  );
}

export type FactsportBroadcastRuntimeConfig = {
  apiKey: string;
  apiSecret: string;
  anonymousSessionSecret: string;
  moderatorRoleReady: boolean;
  issuerReady: boolean;
};

export function getFactsportBroadcastRuntimeConfig(): FactsportBroadcastRuntimeConfig | null {
  const bindings = env as unknown as Record<string, unknown>;
  const apiKey = typeof bindings.STREAM_API_KEY === 'string' ? bindings.STREAM_API_KEY.trim() : '';
  const apiSecret = typeof bindings.STREAM_API_SECRET === 'string' ? bindings.STREAM_API_SECRET : '';
  const anonymousSessionSecret = typeof bindings.FACTSPORT_BROADCAST_ANON_SECRET === 'string'
    ? bindings.FACTSPORT_BROADCAST_ANON_SECRET : '';
  const issuerReady = bindings.FACTSPORT_BROADCAST_TOKEN_ISSUER_READY === 'true';
  const moderatorRoleReady = bindings.FACTSPORT_STREAM_MODERATOR_ROLE_READY === 'true';
  let anonymousSecretValid = false;
  try {
    const normalized = anonymousSessionSecret.replace(/-/g, '+').replace(/_/g, '/');
    anonymousSecretValid = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')).length === 32;
  } catch { anonymousSecretValid = false; }
  if (!apiKey || !apiSecret || !anonymousSecretValid || !issuerReady) return null;
  return { apiKey, apiSecret, anonymousSessionSecret, moderatorRoleReady, issuerReady };
}

export function isFactsportBroadcastTokenIssuerReady(): boolean {
  const bindings = env as unknown as Record<string, unknown>;
  return getFactsportBroadcastRuntimeConfig() !== null &&
    Boolean((bindings.FACTSPORT_BROADCAST_TOKEN_HYPERDRIVE as HyperdriveBinding | undefined)?.connectionString);
}
