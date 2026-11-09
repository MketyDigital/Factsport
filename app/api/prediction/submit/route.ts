import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import {
  createPredictionVisitorToken,
  isAllowedPredictionPublicHost,
  keyedPredictionHash,
  predictionVisitorCookieOptions,
  readPredictionVisitorToken,
  sha256Hex,
  FACTSPORT_PREDICTION_VISITOR_COOKIE,
} from '@/lib/prediction/public-submission';
import {
  isFactsportPredictionPostgresReady,
  withFactsportPredictionPostgres,
} from '@/lib/adapters/postgres-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RULES_VERSION = 'free-prediction-v1';
const RULES_ACCEPTANCE_TEXT =
  'I have read and accept the Factsport free prediction rules and privacy notice.';
const MARKETING_CONSENT_VERSION = 'factsport-email-marketing-v1';
const MARKETING_CONSENT_TEXT =
  'Yes, email me Factsport product updates and offers. I understand I can unsubscribe at any time.';
const MAX_BODY_BYTES = 8192;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SubmissionBody = {
  matchId?: unknown;
  outcome?: unknown;
  homeScore?: unknown;
  awayScore?: unknown;
  email?: unknown;
  displayName?: unknown;
  acceptRules?: unknown;
  marketingOptIn?: unknown;
};

function runtimeConfig() {
  const bindings = env as unknown as Record<string, unknown>;
  const environment = typeof bindings.FACTSPORT_ENVIRONMENT === 'string'
    ? bindings.FACTSPORT_ENVIRONMENT : '';
  const publicHost = typeof bindings.FACTSPORT_PUBLIC_MEDIA_HOST === 'string'
    ? bindings.FACTSPORT_PUBLIC_MEDIA_HOST.trim().toLowerCase() : '';
  const rateLimitSecret = typeof bindings.FACTSPORT_PREDICTION_RATE_LIMIT_SECRET === 'string'
    ? bindings.FACTSPORT_PREDICTION_RATE_LIMIT_SECRET : '';
  const ready = bindings.FACTSPORT_PREDICTION_SUBMISSION_READY === 'true';
  return { environment, publicHost, rateLimitSecret, ready };
}

function requestHostAllowed(request: Request, config: ReturnType<typeof runtimeConfig>): boolean {
  return isAllowedPredictionPublicHost(new URL(request.url), config.environment, config.publicHost);
}

function noStoreJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'Pragma': 'no-cache',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function readBoundedJson(request: Request): Promise<SubmissionBody | null> {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as SubmissionBody : null;
  } catch {
    return null;
  }
}

function validEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.trim().length >= 3;
}

function validScore(value: unknown): value is number | null {
  return value === null || (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 99);
}

function sameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) return false;
  const fetchSite = request.headers.get('sec-fetch-site');
  return !fetchSite || fetchSite === 'same-origin';
}

export async function GET(request: Request) {
  const config = runtimeConfig();
  if (!requestHostAllowed(request, config)) return noStoreJson({ error: 'not_found' }, 404);

  const existing = readPredictionVisitorToken(request);
  const token = existing || createPredictionVisitorToken();
  const response = noStoreJson({ ready: true });
  if (!existing) {
    const host = new URL(request.url).hostname.toLowerCase();
    response.cookies.set(
      FACTSPORT_PREDICTION_VISITOR_COOKIE,
      token,
      predictionVisitorCookieOptions(host, config.environment),
    );
  }
  return response;
}

export async function POST(request: Request) {
  const config = runtimeConfig();
  if (!requestHostAllowed(request, config)) return noStoreJson({ error: 'not_found' }, 404);
  if (!sameOriginRequest(request)) return noStoreJson({ error: 'same_origin_required' }, 403);
  if (!config.ready || !config.rateLimitSecret || !(await isFactsportPredictionPostgresReady())) {
    return noStoreJson({ error: 'prediction_submission_unavailable' }, 503);
  }

  const visitorToken = readPredictionVisitorToken(request);
  if (!visitorToken) return noStoreJson({ error: 'visitor_cookie_required' }, 428);

  const body = await readBoundedJson(request);
  if (!body) return noStoreJson({ error: 'invalid_request_body' }, 400);
  const acceptedFields = new Set([
    'matchId', 'outcome', 'homeScore', 'awayScore', 'email', 'displayName', 'acceptRules', 'marketingOptIn',
  ]);
  if (Object.keys(body).some(field => !acceptedFields.has(field))) {
    return noStoreJson({ error: 'unsupported_request_field' }, 400);
  }
  if (body.acceptRules !== true) return noStoreJson({ error: 'rules_acceptance_required' }, 400);
  if (body.marketingOptIn !== undefined && typeof body.marketingOptIn !== 'boolean') {
    return noStoreJson({ error: 'invalid_marketing_consent' }, 400);
  }
  if (typeof body.matchId !== 'string' || !UUID_PATTERN.test(body.matchId)) {
    return noStoreJson({ error: 'invalid_match' }, 400);
  }
  if (body.outcome !== 'home' && body.outcome !== 'draw' && body.outcome !== 'away') {
    return noStoreJson({ error: 'invalid_outcome' }, 400);
  }
  if (!validScore(body.homeScore ?? null) || !validScore(body.awayScore ?? null) ||
      ((body.homeScore ?? null) === null) !== ((body.awayScore ?? null) === null)) {
    return noStoreJson({ error: 'invalid_score_pair' }, 400);
  }
  if (body.email !== undefined && body.email !== null && !validEmail(body.email)) {
    return noStoreJson({ error: 'invalid_email' }, 400);
  }
  if (body.displayName !== undefined && body.displayName !== null &&
      (typeof body.displayName !== 'string' || body.displayName.trim().length < 2 ||
       body.displayName.trim().length > 40)) {
    return noStoreJson({ error: 'invalid_display_name' }, 400);
  }

  const visitorHash = await sha256Hex(visitorToken);
  const clientIp = request.headers.get('cf-connecting-ip');
  if (!clientIp || clientIp.length > 128) {
    return noStoreJson({ error: 'request_identity_unavailable' }, 503);
  }

  try {
    const [visitorRateKey, networkRateKey] = await Promise.all([
      keyedPredictionHash(config.rateLimitSecret, `visitor:${visitorToken}`),
      keyedPredictionHash(config.rateLimitSecret, `network:${clientIp}`),
    ]);

    const result = await withFactsportPredictionPostgres(async sql => {
      const [visitorLimit] = await sql`
        SELECT public.consume_public_prediction_rate_limit(
          'visitor', ${visitorRateKey}, 60, 10
        ) AS allowed
      `;
      if (visitorLimit?.allowed !== true) return { rateLimited: true as const };

      const [networkLimit] = await sql`
        SELECT public.consume_public_prediction_rate_limit(
          'network', ${networkRateKey}, 60, 60
        ) AS allowed
      `;
      if (networkLimit?.allowed !== true) return { rateLimited: true as const };

      const [submission] = await sql`
        SELECT * FROM public.submit_public_prediction(
          ${visitorHash},
          ${typeof body.email === 'string' ? body.email.trim() : null},
          ${typeof body.displayName === 'string' ? body.displayName.trim() : null},
          ${body.matchId}::uuid,
          ${body.outcome},
          ${RULES_VERSION},
          ${RULES_ACCEPTANCE_TEXT},
          ${body.marketingOptIn === true},
          ${body.marketingOptIn === true ? MARKETING_CONSENT_VERSION : null},
          ${body.marketingOptIn === true ? MARKETING_CONSENT_TEXT : null},
          ${body.homeScore ?? null},
          ${body.awayScore ?? null}
        )
      `;
      return {
        rateLimited: false as const,
        predictionId: submission.prediction_id as string,
        duplicate: submission.duplicate === true,
      };
    });

    if (result.rateLimited) {
      return noStoreJson({ error: 'rate_limited', retryAfterSeconds: 60 }, 429);
    }
    return noStoreJson({
      predictionId: result.predictionId,
      duplicate: result.duplicate,
      marketingConsentStatus: body.marketingOptIn === true ? 'pending_confirmation' : 'not_requested',
    }, result.duplicate ? 200 : 201);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || '') : '';
    const message = error instanceof Error ? error.message : '';
    if (code === '55000') return noStoreJson({ error: 'prediction_closed' }, 409);
    if (code === 'P0002') return noStoreJson({ error: 'match_not_found' }, 404);
    if (message.includes('valid_email_required')) return noStoreJson({ error: 'email_required_for_new_visitor' }, 428);
    if (message.includes('rules_acceptance_required')) return noStoreJson({ error: 'rules_acceptance_required' }, 400);
    if (code === '22023') return noStoreJson({ error: 'invalid_prediction' }, 400);
    return noStoreJson({ error: 'prediction_submission_unavailable' }, 503);
  }
}
