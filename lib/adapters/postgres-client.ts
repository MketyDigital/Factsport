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
export async function isFactsportEditorialPostgresReady(): Promise<boolean> {
  const bindings = env as unknown as Record<string, HyperdriveBinding | undefined>;
  if (!bindings.FACTSPORT_EDITORIAL_HYPERDRIVE?.connectionString) return false;
  try {
    const rows = await withFactsportEditorialPostgres(sql => sql`
      SELECT
        current_user = 'factsport_v2_editorial_writer' AS role_ready,
        to_regclass('public.external_identities') IS NOT NULL AS identities_table_ready,
        to_regclass('public.media_editorial_memberships') IS NOT NULL AS memberships_table_ready,
        has_column_privilege(current_user, 'public.external_identities', 'issuer', 'SELECT')
          AND has_column_privilege(current_user, 'public.external_identities', 'subject', 'SELECT')
          AND has_column_privilege(current_user, 'public.external_identities', 'user_id', 'SELECT')
          AS identity_columns_readable,
        has_table_privilege(current_user, 'public.media_editorial_memberships', 'SELECT')
          AS memberships_readable
    `);
    const ready = rows[0];
    return !!ready && ready.role_ready === true && ready.identities_table_ready === true &&
      ready.memberships_table_ready === true && ready.identity_columns_readable === true &&
      ready.memberships_readable === true;
  } catch {
    return false;
  }
}

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

export function isFactsportSocialReconciliationReady(): boolean {
  const bindings = env as unknown as Record<string, unknown>;
  return bindings.FACTSPORT_SOCIAL_RECONCILIATION_READY === 'true';
}

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
      /^\d{5,15}:[A-Za-z0-9_-]{20,}$/.test(String(bindings.FACTSPORT_TELEGRAM_BOT_TOKEN));
  }
  const adapterUrl = typeof bindings.FACTSPORT_LOGIC_APPS_SOCIAL_ADAPTER_URL === 'string'
    ? String(bindings.FACTSPORT_LOGIC_APPS_SOCIAL_ADAPTER_URL) : '';
  const adapterToken = typeof bindings.FACTSPORT_LOGIC_APPS_SOCIAL_ADAPTER_TOKEN === 'string'
    ? String(bindings.FACTSPORT_LOGIC_APPS_SOCIAL_ADAPTER_TOKEN) : '';
  try {
    const parsed = new URL(adapterUrl);
    return parsed.protocol === 'https:' && !parsed.search && !parsed.hash && adapterToken.length >= 32;
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


/**
 * Dedicated anonymous/registered Prediction API identity.
 * It must be backed by factsport_v2_prediction_api and a separate Hyperdrive
 * binding. Never fall back to the public reader, editorial writer, Supabase,
 * or DATABASE_URL: Prediction owns participant/contact/prediction writes.
 */
export function withFactsportPredictionPostgres<T>(operation: (sql: FactsportSql) => Promise<T> | T): Promise<T> {
  const bindings = env as unknown as Record<string, HyperdriveBinding | undefined>;
  return withConnection(
    bindings.FACTSPORT_PREDICTION_HYPERDRIVE?.connectionString,
    operation,
    'Factsport Prediction API',
  );
}

/**
 * Runtime readiness probe for the minimum anonymous submission contract.
 * The readiness flag alone is insufficient: require the dedicated DB role,
 * required schema objects and explicit effective grants before serving writes.
 */
export async function isFactsportPredictionPostgresReady(): Promise<boolean> {
  const bindings = env as unknown as Record<string, HyperdriveBinding | undefined>;
  if (!bindings.FACTSPORT_PREDICTION_HYPERDRIVE?.connectionString) return false;
  try {
    const rows = await withFactsportPredictionPostgres(sql => sql`
      SELECT
        current_user = 'factsport_v2_prediction_api' AS role_ready,
        to_regclass('public.matches') IS NOT NULL AS matches_ready,
        to_regclass('public.prediction_contacts') IS NOT NULL AS contacts_ready,
        to_regclass('public.prediction_participants') IS NOT NULL AS participants_ready,
        to_regclass('public.predictions') IS NOT NULL AS predictions_ready,
        to_regclass('public.prediction_rule_acceptances') IS NOT NULL AS rule_acceptances_ready,
        to_regclass('public.marketing_subscriptions') IS NOT NULL AS marketing_subscriptions_ready,
        to_regclass('public.marketing_consent_events') IS NOT NULL AS marketing_events_ready,
        to_regprocedure(
          'public.submit_public_prediction(text,text,text,uuid,text,text,text,boolean,text,text,integer,integer)'
        ) IS NOT NULL AS submission_function_ready,
        has_function_privilege(
          current_user,
          'public.submit_public_prediction(text,text,text,uuid,text,text,text,boolean,text,text,integer,integer)',
          'EXECUTE'
        ) AS submission_function_executable,
        to_regprocedure('public.get_public_prediction_visitor_state(text)') IS NOT NULL
          AS visitor_state_function_ready,
        has_function_privilege(
          current_user, 'public.get_public_prediction_visitor_state(text)', 'EXECUTE'
        ) AS visitor_state_function_executable,
        to_regclass('public.prediction_submission_rate_limits') IS NOT NULL AS rate_limits_ready,
        to_regprocedure(
          'public.consume_public_prediction_rate_limit(text,text,integer,integer)'
        ) IS NOT NULL AS rate_limit_function_ready,
        has_function_privilege(
          current_user,
          'public.consume_public_prediction_rate_limit(text,text,integer,integer)',
          'EXECUTE'
        ) AS rate_limit_function_executable
    `);
    const ready = rows[0];
    return !!ready && ready.role_ready === true &&
      ready.matches_ready === true && ready.contacts_ready === true &&
      ready.participants_ready === true && ready.predictions_ready === true &&
      ready.rule_acceptances_ready === true &&
      ready.marketing_subscriptions_ready === true &&
      ready.marketing_events_ready === true &&
      ready.submission_function_ready === true &&
      ready.submission_function_executable === true &&
      ready.visitor_state_function_ready === true &&
      ready.visitor_state_function_executable === true &&
      ready.rate_limits_ready === true &&
      ready.rate_limit_function_ready === true &&
      ready.rate_limit_function_executable === true;
  } catch {
    return false;
  }
}
