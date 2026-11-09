import { NextResponse } from 'next/server';
import { isFactsportSocialMediaProviderReady, isFactsportSocialProviderReady, withFactsportSocialDispatcherPostgres, type FactsportSocialProvider } from '@/lib/adapters/postgres-client';
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
  const providerIds: FactsportSocialProvider[] = ['meta', 'telegram', 'buffer', 'make'];
  const readyProviders = providerIds.filter(isFactsportSocialProviderReady);
  const mediaReadyProviders = providerIds.filter(isFactsportSocialMediaProviderReady);
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

      const rejected = await tx`
        SELECT o.id AS outbox_id, p.id AS publication_id,
          CASE
            WHEN o.attempts >= ${MAX_ATTEMPTS} THEN 'max_attempts_reached'
            WHEN c.is_enabled=false THEN 'channel_disabled'
            WHEN c.surface_scope <> 'public_media' OR p.distribution_scope <> 'public_media' THEN 'invalid_distribution_scope'
            WHEN p.public_content_confirmed_by IS NULL OR p.public_content_confirmed_at IS NULL THEN 'missing_public_content_attestation'
            ELSE 'dispatch_not_eligible'
          END AS reason
        FROM public.media_social_outbox o
        JOIN public.media_social_publications p ON p.id=o.publication_id
        JOIN public.media_social_channels c ON c.id=p.channel_id
        WHERE o.status IN ('pending','retry')
          AND o.available_at <= now()
          AND p.status IN ('scheduled','queued')
          AND p.scheduled_at <= now()
          AND (
            o.attempts >= ${MAX_ATTEMPTS}
            OR c.is_enabled=false
            OR c.surface_scope <> 'public_media'
            OR p.distribution_scope <> 'public_media'
            OR p.public_content_confirmed_by IS NULL
            OR p.public_content_confirmed_at IS NULL
          )
        ORDER BY o.available_at, o.created_at
        FOR UPDATE OF o, p SKIP LOCKED
        LIMIT 50
      `;
      for (const row of rejected) {
        await tx`
          UPDATE public.media_social_outbox
          SET status='dead_letter', lease_owner=NULL, lease_expires_at=NULL,
              last_error_code=${row.reason}, updated_at=now()
          WHERE id=${row.outbox_id}::uuid
        `;
        await tx`
          UPDATE public.media_social_publications
          SET status='failed', last_error_code=${row.reason},
              last_error_message='This scheduled post no longer meets the public Media dispatch requirements.',
              locked_at=NULL, locked_by=NULL, updated_at=now()
          WHERE id=${row.publication_id}::uuid
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
            AND c.provider = ANY(${readyProviders}::text[])
            AND (cardinality(p.media_asset_ids)=0 OR (c.supports_media=true AND c.provider = ANY(${mediaReadyProviders}::text[])))
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
              lease_owner=${workerId}, lease_expires_at=now() + make_interval(mins => ${LEASE_MINUTES}),
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
          c.provider, c.channel_key, c.display_name, c.supports_media,
          CASE c.provider
            WHEN 'meta' THEN jsonb_build_object('pageId', c.settings->>'page_id')
            WHEN 'buffer' THEN jsonb_build_object('profileId', c.settings->>'profile_id')
            WHEN 'telegram' THEN jsonb_build_object('chatIds', c.settings->'chat_ids')
            WHEN 'make' THEN jsonb_build_object('routeKey', c.settings->>'route_key')
            ELSE '{}'::jsonb
          END AS provider_config,
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
            INSERT INTO public.media_social_delivery_attempts
              (publication_id, attempt_number, outcome, error_code, error_message, finished_at)
            VALUES (
              ${job.id}::uuid, ${job.attempts}, 'permanent_failure',
              'media_not_public_or_channel_unsupported',
              'One or more attached images are no longer eligible for this public channel.',
              now()
            )
            ON CONFLICT (publication_id, attempt_number) DO UPDATE SET
              outcome='permanent_failure', error_code=EXCLUDED.error_code,
              error_message=EXCLUDED.error_message, finished_at=now()
          `;
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
          channelKey: job.channel_key,
          channelName: job.display_name,
          providerConfig: job.provider_config,
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
