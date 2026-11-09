import { NextResponse } from 'next/server';
import { withFactsportSocialDispatcherPostgres } from '@/lib/adapters/postgres-client';
import { isSocialDispatcherRequestAuthorized } from '../_auth';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const BATCH_LIMIT = 10;
const LEASE_MINUTES = 5;
const MAX_ATTEMPTS = 6;

export async function POST(request: Request) {
  if (!(await isSocialDispatcherRequestAuthorized(request))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const workerId = crypto.randomUUID();
  const publicOrigin = new URL(request.url).origin;
  try {
    const result = await withFactsportSocialDispatcherPostgres(async sql => sql.begin(async tx => {
      const expired = await tx`
        UPDATE public.media_social_outbox
        SET status='dead_letter', lease_owner=NULL, lease_expires_at=NULL,
            last_error_code='unknown_result', updated_at=now()
        WHERE status='processing' AND lease_expires_at < now()
        RETURNING publication_id, attempts
      `;
      for (const row of expired) {
        await tx`
          UPDATE public.media_social_publications
          SET status='failed', last_error_code='unknown_result',
              last_error_message='Dispatcher lease expired after provider handoff; reconcile before retrying.',
              locked_at=NULL, locked_by=NULL, updated_at=now()
          WHERE id=${row.publication_id}::uuid AND status='publishing'
        `;
        await tx`
          UPDATE public.media_social_delivery_attempts
          SET outcome='unknown_result', error_code='lease_expired',
              error_message='Provider result is unknown; automatic retry was suppressed.',
              finished_at=now()
          WHERE publication_id=${row.publication_id}::uuid
            AND attempt_number=${row.attempts} AND outcome='started'
        `;
      }

      const jobs = await tx`
        WITH due AS (
          SELECT o.id AS outbox_id, p.id AS publication_id
          FROM public.media_social_outbox o
          JOIN public.media_social_publications p ON p.id=o.publication_id
          JOIN public.media_social_channels c ON c.id=p.channel_id
          WHERE o.status IN ('pending','retry')
            AND o.available_at <= now()
            AND p.status IN ('scheduled','queued')
            AND p.scheduled_at <= now()
            AND c.is_enabled=true
            AND c.surface_scope='public_media'
            AND p.distribution_scope='public_media'
            AND p.public_content_confirmed_by IS NOT NULL
            AND p.public_content_confirmed_at IS NOT NULL
            AND o.attempts < ${MAX_ATTEMPTS}
          ORDER BY o.available_at ASC, o.created_at ASC
          FOR UPDATE OF o, p SKIP LOCKED
          LIMIT ${BATCH_LIMIT}
        ),
        claimed AS (
          UPDATE public.media_social_outbox o
          SET status='processing', attempts=o.attempts+1,
              lease_owner=${workerId}, lease_expires_at=now() + (${LEASE_MINUTES} || ' minutes')::interval,
              updated_at=now()
          FROM due
          WHERE o.id=due.outbox_id
          RETURNING o.id AS outbox_id, o.publication_id, o.attempts
        ),
        publishing AS (
          UPDATE public.media_social_publications p
          SET status='publishing', attempt_count=claimed.attempts,
              locked_at=now(), locked_by=${workerId}, updated_at=now()
          FROM claimed
          WHERE p.id=claimed.publication_id
          RETURNING p.id, p.channel_id, p.content_text, p.link_url,
                    p.media_asset_ids, p.scheduled_at, p.idempotency_key,
                    claimed.outbox_id, claimed.attempts
        )
        SELECT publishing.*,
          c.provider, c.display_name, c.settings, c.supports_media,
          media.items AS media_assets
        FROM publishing
        JOIN public.media_social_channels c ON c.id=publishing.channel_id
        LEFT JOIN LATERAL (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', asset.id,
            'url', ${publicOrigin} || '/api/media/' || asset.object_key,
            'contentType', asset.content_type,
            'width', asset.width,
            'height', asset.height,
            'altText', asset.alt_text,
            'attribution', asset.attribution_text
          ) ORDER BY selected.ordinality), '[]'::jsonb) AS items
          FROM unnest(publishing.media_asset_ids) WITH ORDINALITY AS selected(id, ordinality)
          JOIN public.public_social_media_assets asset ON asset.id=selected.id
        ) media ON true
      `;

      const ready: any[] = [];
      for (const job of jobs) {
        const assets = Array.isArray(job.media_assets) ? job.media_assets : [];
        const expectedAssets = Array.isArray(job.media_asset_ids) ? job.media_asset_ids.length : 0;
        if ((expectedAssets > 0 && !job.supports_media) || assets.length !== expectedAssets) {
          await tx`
            UPDATE public.media_social_outbox
            SET status='dead_letter', lease_owner=NULL, lease_expires_at=NULL,
                last_error_code='media_not_public_or_channel_unsupported', updated_at=now()
            WHERE id=${job.outbox_id}::uuid AND lease_owner=${workerId}
          `;
          await tx`
            UPDATE public.media_social_publications
            SET status='failed', last_error_code='media_not_public_or_channel_unsupported',
                last_error_message='One or more attached images are no longer eligible for this public channel.',
                locked_at=NULL, locked_by=NULL, updated_at=now()
            WHERE id=${job.id}::uuid AND locked_by=${workerId}
          `;
          continue;
        }
        await tx`
          INSERT INTO public.media_social_delivery_attempts
            (publication_id, attempt_number, outcome)
          VALUES (${job.id}::uuid, ${job.attempts}, 'started')
          ON CONFLICT (publication_id, attempt_number) DO NOTHING
        `;
        ready.push({
          outboxId: job.outbox_id,
          publicationId: job.id,
          attemptNumber: job.attempts,
          workerId,
          idempotencyKey: job.idempotency_key,
          provider: job.provider,
          channelName: job.display_name,
          channelSettings: job.settings,
          contentText: job.content_text,
          linkUrl: job.link_url,
          scheduledAt: job.scheduled_at,
          media: assets,
        });
      }
      return { workerId, claimed: ready.length, jobs: ready };
    }));
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Social dispatcher claim failed', error);
    return NextResponse.json({ error: 'Social dispatch queue unavailable.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
