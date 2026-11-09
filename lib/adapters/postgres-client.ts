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


/** Dedicated social dispatcher identity; it cannot read private Prediction or edit editorial content. */
export function withFactsportSocialDispatcherPostgres<T>(operation: (sql: FactsportSql) => Promise<T> | T): Promise<T> {
  const bindings = env as unknown as Record<string, HyperdriveBinding | undefined>;
  return withConnection(
    bindings.FACTSPORT_SOCIAL_DISPATCHER_HYPERDRIVE?.connectionString,
    operation,
    'Factsport social dispatcher',
  );
}


export type FactsportSocialProvider = 'meta' | 'telegram' | 'buffer' | 'make';

export function isFactsportSocialDispatchReady(): boolean {
  const bindings = env as unknown as Record<string, unknown>;
  const hyperdrive = bindings.FACTSPORT_SOCIAL_DISPATCHER_HYPERDRIVE as HyperdriveBinding | undefined;
  return bindings.FACTSPORT_SOCIAL_DISPATCH_READY === 'true' &&
    Boolean(hyperdrive?.connectionString) &&
    typeof bindings.FACTSPORT_SOCIAL_DISPATCH_TOKEN === 'string' &&
    String(bindings.FACTSPORT_SOCIAL_DISPATCH_TOKEN).length >= 32;
}

export function isFactsportSocialProviderReady(provider: FactsportSocialProvider): boolean {
  const bindings = env as unknown as Record<string, unknown>;
  const readiness: Record<FactsportSocialProvider, string> = {
    meta: 'FACTSPORT_SOCIAL_PROVIDER_META_READY',
    telegram: 'FACTSPORT_SOCIAL_PROVIDER_TELEGRAM_READY',
    buffer: 'FACTSPORT_SOCIAL_PROVIDER_BUFFER_READY',
    make: 'FACTSPORT_SOCIAL_PROVIDER_MAKE_READY',
  };
  if (bindings[readiness[provider]] !== 'true') return false;
  if (provider === 'meta') {
    return typeof bindings.FACTSPORT_META_PAGE_ACCESS_TOKEN === 'string' &&
      String(bindings.FACTSPORT_META_PAGE_ACCESS_TOKEN).length >= 40;
  }
  if (provider === 'telegram') {
    return typeof bindings.FACTSPORT_TELEGRAM_BOT_TOKEN === 'string' &&
      /^\\d{5,15}:[A-Za-z0-9_-]{20,}$/.test(String(bindings.FACTSPORT_TELEGRAM_BOT_TOKEN));
  }
  const adapterUrl = typeof bindings.FACTSPORT_LOGIC_APPS_SOCIAL_ADAPTER_URL === 'string'
    ? String(bindings.FACTSPORT_LOGIC_APPS_SOCIAL_ADAPTER_URL) : '';
  const adapterToken = typeof bindings.FACTSPORT_LOGIC_APPS_SOCIAL_ADAPTER_TOKEN === 'string'
    ? String(bindings.FACTSPORT_LOGIC_APPS_SOCIAL_ADAPTER_TOKEN) : '';
  try {
    return new URL(adapterUrl).protocol === 'https:' && adapterToken.length >= 32;
  } catch { return false; }
}

export function isFactsportSocialMediaProviderReady(provider: FactsportSocialProvider): boolean {
  const bindings = env as unknown as Record<string, unknown>;
  const readiness: Record<FactsportSocialProvider, string> = {
    meta: 'FACTSPORT_SOCIAL_MEDIA_META_READY',
    telegram: 'FACTSPORT_SOCIAL_MEDIA_TELEGRAM_READY',
    buffer: 'FACTSPORT_SOCIAL_MEDIA_BUFFER_READY',
    make: 'FACTSPORT_SOCIAL_MEDIA_MAKE_READY',
  };
  return isFactsportSocialProviderReady(provider) && bindings[readiness[provider]] === 'true';
}
