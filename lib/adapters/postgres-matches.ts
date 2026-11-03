/**
 * Server-only PostgreSQL reader for the Factsport v2 public matches API.
 * This is deliberately read-only; fixture sync and live ESPN arbitration
 * are not switched by this adapter.
 */
import 'server-only';
import postgres from 'postgres';
import { env } from 'cloudflare:workers';

const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

let client: ReturnType<typeof postgres> | undefined;

function db() {
  if (!client) {
    // vinext/Workers resolves credentials from the secure, server-only Hyperdrive
    // binding. Do not copy or expose its connection string.
    const cloudflareUrl = env?.FACTSPORT_HYPERDRIVE?.connectionString;
    const directUrl = process.env.DATABASE_URL;
    if (cloudflareUrl) {
      client = postgres(cloudflareUrl, {
        max: 3, fetch_types: false, prepare: true,
        idle_timeout: 10, connect_timeout: 10,
      });
    } else if (directUrl) {
      // Azure direct TLS fallback for approved non-Worker verification only.
      client = postgres(directUrl, {
        ssl: 'require', max: 3, idle_timeout: 20, connect_timeout: 10,
      });
    } else {
      throw new Error('Factsport PostgreSQL connection is not configured');
    }
  }
  return client;
}

export async function listPostgresMatches(input: {
  league: string;
  cursor: string;
  type: 'results' | 'fixtures';
}) {
  if (input.league.length > 100) throw new Error('Invalid league');
  const date = new Date(input.cursor);
  if (!Number.isFinite(date.valueOf())) throw new Error('Invalid cursor');
  const sql = db();
  const cursor = date.toISOString();

  if (input.type === 'results') {
    return sql`
      SELECT * FROM public.matches
      WHERE league = ${input.league}
        AND status = ANY(${FINISHED_STATUSES}::text[])
        AND match_date < ${cursor}
      ORDER BY match_date DESC, id DESC LIMIT 15
    `;
  }
  return sql`
    SELECT * FROM public.matches
    WHERE league = ${input.league}
      AND status <> ALL(${FINISHED_STATUSES}::text[])
      AND match_date > ${cursor}
    ORDER BY match_date ASC, id ASC LIMIT 15
  `;
}
