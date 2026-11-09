import { NextResponse } from 'next/server';
import { withFactsportSocialDispatcherPostgres } from '@/lib/adapters/postgres-client';
import { isSocialDispatcherRequestAuthorized } from '../_auth';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 6;

type DispatchResult = {
  outboxId: string;
  publicationId: string;
  workerId: string;
  attemptNumber: number;
  outcome: 'succeeded' | 'retryable_failure' | 'permanent_failure' | 'unknown_result';
  providerRequestId?: string;
  providerPostId?: string;
  providerPostUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  responseSummary?: Record<string, string | number | boolean | null>;
};

function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const result = value.trim();
  return result ? result.slice(0, max) : null;
}

function safeProviderUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch { return null; }
}

export async function POST(request: Request) {
  if (!(await isSocialDispatcherRequestAuthorized(request))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  let input: DispatchResult;
  try {
    const raw = await request.text();
    if (raw.length > 16_384) return NextResponse.json({ error: 'Result payload too large.' }, { status: 413 });
    input = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid result payload.' }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(input?.outboxId || '') ||
      !/^[0-9a-f-]{36}$/i.test(input?.publicationId || '') ||
      !/^[0-9a-f-]{36}$/i.test(input?.workerId || '') ||
      !Number.isInteger(input?.attemptNumber) || input.attemptNumber < 1 ||
      !['succeeded', 'retryable_failure', 'permanent_failure', 'unknown_result'].includes(input?.outcome)) {
    return NextResponse.json({ error: 'Invalid dispatch result identity or outcome.' }, { status: 400 });
  }

  const providerRequestId = boundedText(input.providerRequestId, 200);
  const providerPostId = boundedText(input.providerPostId, 300);
  const providerPostUrl = safeProviderUrl(input.providerPostUrl);
  const errorCode = boundedText(input.errorCode, 100);
  const errorMessage = boundedText(input.errorMessage, 1000);
  const responseSummary = input.responseSummary && typeof input.responseSummary === 'object'
    ? Object.fromEntries(Object.entries(input.responseSummary).slice(0, 10).map(([key, value]) => [
        key.slice(0, 64),
        typeof value === 'string' ? value.slice(0, 200) :
          typeof value === 'number' || typeof value === 'boolean' || value === null ? value : null,
      ]))
    : {};

  if (input.outcome === 'succeeded' && !providerPostId) {
    return NextResponse.json({ error: 'A successful delivery must include a provider post ID.' }, { status: 400 });
  }

  try {
    const result = await withFactsportSocialDispatcherPostgres(async sql => sql.begin(async tx => {
      const rows = await tx`
        SELECT o.id, o.publication_id, o.status AS outbox_status, o.lease_owner,
               o.lease_expires_at, o.attempts, p.status AS publication_status
        FROM public.media_social_outbox o
        JOIN public.media_social_publications p ON p.id=o.publication_id
        WHERE o.id=${input.outboxId}::uuid AND p.id=${input.publicationId}::uuid
        FOR UPDATE OF o, p
      `;
      const current = rows[0];
      if (!current) throw new Error('Dispatch claim was not found.');
      if (current.outbox_status !== 'processing' || current.lease_owner !== input.workerId ||
          Number(current.attempts) !== input.attemptNumber || new Date(current.lease_expires_at).valueOf() <= Date.now()) {
        const prior = await tx`
          SELECT outcome, provider_post_id FROM public.media_social_delivery_attempts
          WHERE publication_id=${input.publicationId}::uuid AND attempt_number=${input.attemptNumber}
          LIMIT 1
        `;
        if (prior.length && prior[0].outcome === input.outcome &&
            (!providerPostId || prior[0].provider_post_id === providerPostId)) return { duplicate: true };
        throw new Error('Dispatch claim is expired, superseded or owned by another worker.');
      }

      const attempt = await tx`
        SELECT id, outcome FROM public.media_social_delivery_attempts
        WHERE publication_id=${input.publicationId}::uuid AND attempt_number=${input.attemptNumber}
        FOR UPDATE
      `;
      if (!attempt.length || attempt[0].outcome !== 'started') throw new Error('Delivery attempt is not awaiting a result.');

      await tx`
        UPDATE public.media_social_delivery_attempts SET
          outcome=${input.outcome},
          provider_request_id=${providerRequestId},
          provider_post_id=${providerPostId},
          provider_response=${JSON.stringify(responseSummary)}::jsonb,
          error_code=${errorCode},
          error_message=${errorMessage},
          finished_at=now()
        WHERE id=${attempt[0].id}::uuid
      `;

      if (input.outcome === 'succeeded') {
        await tx`
          UPDATE public.media_social_publications SET
            status='published', published_at=now(), provider_post_id=${providerPostId},
            provider_post_url=${providerPostUrl}, last_error_code=NULL, last_error_message=NULL,
            locked_at=NULL, locked_by=NULL, updated_at=now()
          WHERE id=${input.publicationId}::uuid
        `;
        await tx`
          UPDATE public.media_social_outbox SET
            status='completed', lease_owner=NULL, lease_expires_at=NULL,
            last_error_code=NULL, updated_at=now()
          WHERE id=${input.outboxId}::uuid
        `;
        return { duplicate: false, status: 'completed' };
      }

      const terminal = input.outcome === 'permanent_failure' || input.outcome === 'unknown_result' ||
        input.attemptNumber >= MAX_ATTEMPTS;
      if (terminal) {
        const finalCode = input.outcome === 'unknown_result' ? 'unknown_result' : errorCode || input.outcome;
        await tx`
          UPDATE public.media_social_publications SET
            status='failed', last_error_code=${finalCode},
            last_error_message=${errorMessage || (input.outcome === 'unknown_result'
              ? 'Provider result is ambiguous; reconcile before retrying.'
              : 'Provider rejected the post permanently.')},
            locked_at=NULL, locked_by=NULL, updated_at=now()
          WHERE id=${input.publicationId}::uuid
        `;
        await tx`
          UPDATE public.media_social_outbox SET
            status='dead_letter', lease_owner=NULL, lease_expires_at=NULL,
            last_error_code=${finalCode}, updated_at=now()
          WHERE id=${input.outboxId}::uuid
        `;
        return { duplicate: false, status: 'dead_letter' };
      }

      const delaySeconds = Math.min(3600, 30 * (2 ** Math.max(0, input.attemptNumber - 1)));
      await tx`
        UPDATE public.media_social_publications SET
          status='scheduled', last_error_code=${errorCode || 'retryable_failure'},
          last_error_message=${errorMessage || 'Provider delivery failed temporarily.'},
          locked_at=NULL, locked_by=NULL, updated_at=now()
        WHERE id=${input.publicationId}::uuid
      `;
      await tx`
        UPDATE public.media_social_outbox SET
          status='retry', available_at=now() + make_interval(secs => ${delaySeconds}),
          lease_owner=NULL, lease_expires_at=NULL,
          last_error_code=${errorCode || 'retryable_failure'}, updated_at=now()
        WHERE id=${input.outboxId}::uuid
      `;
      return { duplicate: false, status: 'retry', retryAfterSeconds: delaySeconds };
    }));
    return NextResponse.json({ success: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Social dispatcher result rejected', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to record delivery result.' }, {
      status: 409,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
