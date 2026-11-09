import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import {
  isFactsportSocialMediaProviderReady,
  isFactsportSocialProviderReady,
  withFactsportSocialDispatcherPostgres,
  type FactsportSocialProvider,
} from '@/lib/adapters/postgres-client';
import { isSocialDispatcherRequestAuthorized } from '../_auth';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type ClaimInput = { outboxId: string; publicationId: string; workerId: string; attemptNumber: number };
type MediaAsset = { id: string; url: string; content_type: string; byte_size: number; width: number | null; height: number | null; alt_text: string | null; attribution_text: string | null };

function textValue(value: unknown, max = 300): string | null {
  if (typeof value !== 'string') return null;
  const valueText = value.trim();
  return valueText ? valueText.slice(0, max) : null;
}

function redact(value: string): string {
  return value.replace(/(access[_ -]?token|refresh[_ -]?token|api[_ -]?key|secret|password)[=: ]+[^\s&]+/gi, '$1=[redacted]').slice(0, 1000);
}

function providerError(outcome: 'retryable_failure' | 'permanent_failure' | 'unknown_result', errorCode: string, errorMessage: string, requestId?: string) {
  return {
    success: true, outcome, errorCode, errorMessage: redact(errorMessage),
    providerRequestId: textValue(requestId, 200) || undefined,
  };
}

async function readJson(response: Response): Promise<any> {
  const body = await response.text();
  if (body.length > 32_768) return null;
  try { return JSON.parse(body); } catch { return null; }
}

async function dispatchMeta(job: any, token: string, version: string) {
  const pageId = textValue(job.settings?.page_id, 40);
  if (!pageId || !/^\d{5,30}$/.test(pageId)) {
    return providerError('permanent_failure', 'meta_page_id_missing', 'The Meta Page ID is not configured.');
  }
  if (job.media.length > 1) {
    return providerError('permanent_failure', 'meta_multiple_images_not_supported', 'This Meta adapter currently accepts one image per post.');
  }
  const base = `https://graph.facebook.com/${version}/${encodeURIComponent(pageId)}`;
  const content = job.linkUrl ? `${job.contentText}\n${job.linkUrl}` : job.contentText;
  const body = new URLSearchParams();
  let endpoint = `${base}/feed`;
  if (job.media.length === 1) {
    endpoint = `${base}/photos`;
    body.set('url', job.media[0].url);
    body.set('caption', content);
    body.set('published', 'true');
  } else {
    body.set('message', job.contentText);
    if (job.linkUrl) body.set('link', job.linkUrl);
  }
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return providerError('unknown_result', 'meta_network_result_unknown', 'Meta did not return a confirmed result; reconcile before retrying.');
  }
  const data = await readJson(response);
  if (!response.ok || data?.error) {
    const code = String(data?.error?.code || response.status);
    if (response.status === 429 || ['4', '17', '32', '613'].includes(code)) {
      return providerError('retryable_failure', 'meta_rate_limited', 'Meta rate-limited this post; it will be retried with backoff.', data?.fbtrace_id);
    }
    if (response.status >= 500) {
      return providerError('unknown_result', 'meta_server_result_unknown', 'Meta returned a server error; reconcile before retrying.', data?.fbtrace_id);
    }
    return providerError('permanent_failure', 'meta_rejected_post', 'Meta rejected the post. Check the Page permissions, token and content policy.', data?.fbtrace_id);
  }
  const postId = textValue(data?.post_id || data?.id, 300);
  if (!postId) return providerError('unknown_result', 'meta_post_id_missing', 'Meta accepted the request but did not return a post ID; reconcile before retrying.', data?.fbtrace_id);
  return {
    success: true, outcome: 'succeeded' as const,
    providerPostId: postId,
    providerPostUrl: /^\d+_\d+$/.test(postId) ? `https://www.facebook.com/${postId}` : undefined,
    providerRequestId: textValue(data?.fbtrace_id, 200) || undefined,
    responseSummary: { provider: 'meta', postId },
  };
}

async function dispatchTelegram(job: any, token: string) {
  const chatIds = Array.isArray(job.settings?.chat_ids)
    ? job.settings.chat_ids.filter((value: unknown): value is string => typeof value === 'string').slice(0, 5)
    : [];
  if (!chatIds.length) return providerError('permanent_failure', 'telegram_chat_id_missing', 'No Telegram chat IDs are configured.');
  if (job.media.some((asset: MediaAsset) => asset.byte_size > 5 * 1024 * 1024)) {
    return providerError('permanent_failure', 'telegram_image_too_large_for_url', 'Telegram URL-based photo delivery is limited to 5 MB per image.');
  }
  const caption = job.linkUrl ? `${job.contentText}\n${job.linkUrl}` : job.contentText;
  if (job.media.length && caption.length > 1024) {
    return providerError('permanent_failure', 'telegram_caption_too_long', 'Telegram image captions are limited to 1,024 characters; shorten the post or remove its images.');
  }
  if (!job.media.length && caption.length > 4096) {
    return providerError('permanent_failure', 'telegram_message_too_long', 'Telegram text messages are limited to 4,096 characters.');
  }

  const sent: Array<{ chatId: string; messageIds: number[] }> = [];
  for (const chatId of chatIds) {
    const method = job.media.length === 0 ? 'sendMessage' : job.media.length === 1 ? 'sendPhoto' : 'sendMediaGroup';
    const payload: Record<string, unknown> = { chat_id: chatId };
    if (method === 'sendMessage') payload.text = caption;
    if (method === 'sendPhoto') {
      payload.photo = job.media[0].url;
      payload.caption = caption;
    }
    if (method === 'sendMediaGroup') {
      payload.media = job.media.map((asset: MediaAsset, index: number) => ({
        type: 'photo', media: asset.url, ...(index === 0 ? { caption } : {}),
      }));
    }
    let response: Response;
    try {
      response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      return providerError('unknown_result', 'telegram_network_result_unknown', sent.length
        ? 'Telegram accepted some destinations but a later result is unknown; reconcile before retrying.'
        : 'Telegram did not return a confirmed result; reconcile before retrying.');
    }
    const data = await readJson(response);
    if (!response.ok || data?.ok !== true) {
      if (sent.length) return providerError('unknown_result', 'telegram_partial_delivery', 'Telegram accepted some destinations before a later destination failed; reconcile before retrying.');
      if (response.status === 429 || Number(data?.error_code) === 429) {
        return providerError('retryable_failure', 'telegram_rate_limited', 'Telegram rate-limited this post; it will be retried with backoff.');
      }
      if (response.status >= 500) return providerError('unknown_result', 'telegram_server_result_unknown', 'Telegram returned a server error; reconcile before retrying.');
      return providerError('permanent_failure', 'telegram_rejected_post', 'Telegram rejected the post. Check chat permissions, bot access and content limits.');
    }
    const messages = Array.isArray(data.result) ? data.result : [data.result];
    const messageIds = messages.map((message: any) => Number(message?.message_id)).filter((id: number) => Number.isInteger(id));
    if (!messageIds.length) {
      return providerError('unknown_result', 'telegram_message_id_missing', 'Telegram accepted the request but did not return a message ID; reconcile before retrying.');
    }
    sent.push({ chatId, messageIds });
  }
  const providerPostId = JSON.stringify(sent);
  return {
    success: true, outcome: 'succeeded' as const,
    providerPostId,
    providerRequestId: undefined,
    responseSummary: { provider: 'telegram', destinationCount: sent.length },
  };
}

async function dispatchLogicApps(job: any, adapterUrl: string, adapterToken: string) {
  const url = new URL(adapterUrl);
  if (url.protocol !== 'https:') return providerError('permanent_failure', 'logic_apps_adapter_url_invalid', 'The Logic Apps adapter must use HTTPS.');
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adapterToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': job.idempotencyKey,
      },
      body: JSON.stringify({
        provider: job.provider,
        channelKey: job.channelKey,
        providerConfig: job.provider === 'buffer'
          ? { profileId: job.settings?.profile_id }
          : { routeKey: job.settings?.route_key },
        publicationId: job.publicationId,
        idempotencyKey: job.idempotencyKey,
        contentText: job.contentText,
        linkUrl: job.linkUrl,
        media: job.media,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return providerError('unknown_result', 'logic_apps_adapter_result_unknown', 'The Logic Apps provider adapter did not return a confirmed result; reconcile before retrying.');
  }
  const data = await readJson(response);
  if (!response.ok) {
    if (response.status === 429) return providerError('retryable_failure', 'logic_apps_adapter_rate_limited', 'The Logic Apps adapter is rate-limited; the post will be retried.');
    if (response.status >= 500) return providerError('unknown_result', 'logic_apps_adapter_result_unknown', 'The Logic Apps adapter returned a server error; reconcile before retrying.');
    return providerError('permanent_failure', 'logic_apps_adapter_rejected', 'The Logic Apps adapter rejected this post configuration.');
  }
  const providerPostId = textValue(data?.providerPostId || data?.postId, 300);
  if (!providerPostId) return providerError('unknown_result', 'logic_apps_provider_post_id_missing', 'The provider adapter returned no post ID; reconcile before retrying.');
  return {
    success: true, outcome: 'succeeded' as const,
    providerPostId,
    providerPostUrl: textValue(data?.providerPostUrl, 2000) || undefined,
    providerRequestId: textValue(data?.requestId, 200) || undefined,
    responseSummary: { provider: job.provider, postId: providerPostId },
  };
}

export async function POST(request: Request) {
  if (!(await isSocialDispatcherRequestAuthorized(request))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  let input: ClaimInput;
  try {
    const raw = await request.text();
    if (raw.length > 8_192) return NextResponse.json({ error: 'Delivery request too large.' }, { status: 413 });
    input = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid delivery request.' }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(input?.outboxId || '') ||
      !/^[0-9a-f-]{36}$/i.test(input?.publicationId || '') ||
      !/^[0-9a-f-]{36}$/i.test(input?.workerId || '') ||
      !Number.isInteger(input?.attemptNumber) || input.attemptNumber < 1) {
    return NextResponse.json({ error: 'Invalid delivery claim identity.' }, { status: 400 });
  }

  try {
    const job = await withFactsportSocialDispatcherPostgres(async sql => sql.begin(async tx => {
      const rows = await tx`
        SELECT o.id AS outbox_id, o.publication_id, o.status AS outbox_status,
               o.lease_owner, o.lease_expires_at, o.attempts,
               p.idempotency_key, p.content_text, p.link_url, p.media_asset_ids,
               c.provider, c.channel_key, c.settings, c.supports_media,
               attempt.id AS attempt_id, attempt.outcome, attempt.provider_started_at,
               media.items AS media_assets
        FROM public.media_social_outbox o
        JOIN public.media_social_publications p ON p.id=o.publication_id
        JOIN public.media_social_channels c ON c.id=p.channel_id
        JOIN public.media_social_delivery_attempts attempt
          ON attempt.publication_id=p.id AND attempt.attempt_number=o.attempts
        LEFT JOIN LATERAL (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', asset.id, 'url', ${new URL(request.url).origin} || '/api/media/' || asset.object_key,
            'content_type', asset.content_type, 'byte_size', asset.byte_size,
            'width', asset.width, 'height', asset.height,
            'alt_text', asset.alt_text, 'attribution_text', asset.attribution_text
          ) ORDER BY selected.ordinality), '[]'::jsonb) AS items
          FROM unnest(p.media_asset_ids) WITH ORDINALITY AS selected(id, ordinality)
          JOIN public.public_social_media_assets asset ON asset.id=selected.id
        ) media ON true
        WHERE o.id=${input.outboxId}::uuid AND p.id=${input.publicationId}::uuid
        FOR UPDATE OF o, p, attempt
      `;
      const row = rows[0];
      if (!row || row.outbox_status !== 'processing' || row.lease_owner !== input.workerId ||
          Number(row.attempts) !== input.attemptNumber || row.outcome !== 'started' ||
          new Date(row.lease_expires_at).valueOf() <= Date.now()) {
        throw new Error('Dispatch claim is missing, expired or already consumed.');
      }
      if (row.provider_started_at) throw new Error('This delivery attempt has already started a provider request.');
      const media = Array.isArray(row.media_assets) ? row.media_assets : [];
      const expected = Array.isArray(row.media_asset_ids) ? row.media_asset_ids.length : 0;
      if (media.length !== expected || (expected > 0 && !row.supports_media)) {
        throw new Error('Attached media is no longer public or this channel is not verified for image delivery.');
      }
      await tx`
        UPDATE public.media_social_delivery_attempts
        SET provider_started_at=now()
        WHERE id=${row.attempt_id}::uuid AND outcome='started' AND provider_started_at IS NULL
      `;
      return {
        outboxId: row.outbox_id, publicationId: row.publication_id,
        attemptNumber: row.attempts, idempotencyKey: row.idempotency_key,
        provider: row.provider as FactsportSocialProvider,
        channelKey: row.channel_key, settings: row.settings || {},
        contentText: row.content_text, linkUrl: row.link_url,
        media,
      };
    }));

    if (!isFactsportSocialProviderReady(job.provider)) {
      return NextResponse.json(providerError('retryable_failure', 'provider_not_ready', 'Provider credentials or adapter readiness are not available.'), { headers: { 'Cache-Control': 'no-store' } });
    }
    if (job.media.length && !isFactsportSocialMediaProviderReady(job.provider)) {
      return NextResponse.json(providerError('retryable_failure', 'provider_media_not_ready', 'Image delivery is not enabled for this provider yet.'), { headers: { 'Cache-Control': 'no-store' } });
    }

    const bindings = env as unknown as Record<string, unknown>;
    let result: any;
    if (job.provider === 'meta') {
      const token = String(bindings.FACTSPORT_META_PAGE_ACCESS_TOKEN || '');
      const versionRaw = typeof bindings.FACTSPORT_META_GRAPH_API_VERSION === 'string'
        ? String(bindings.FACTSPORT_META_GRAPH_API_VERSION) : 'v26.0';
      const version = /^v\d{1,2}\.0$/.test(versionRaw) ? versionRaw : 'v26.0';
      result = await dispatchMeta(job, token, version);
    } else if (job.provider === 'telegram') {
      result = await dispatchTelegram(job, String(bindings.FACTSPORT_TELEGRAM_BOT_TOKEN || ''));
    } else {
      result = await dispatchLogicApps(
        job,
        String(bindings.FACTSPORT_LOGIC_APPS_SOCIAL_ADAPTER_URL || ''),
        String(bindings.FACTSPORT_LOGIC_APPS_SOCIAL_ADAPTER_TOKEN || ''),
      );
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Social provider delivery was not started or confirmed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to start provider delivery.' }, {
      status: 409,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
