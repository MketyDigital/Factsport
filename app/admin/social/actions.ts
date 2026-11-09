'use server';

import { revalidatePath } from 'next/cache';
import { isFactsportSocialDispatchReady, isFactsportSocialMediaProviderReady, isFactsportSocialProviderReady, withFactsportEditorialPostgres, type FactsportSocialProvider } from '@/lib/adapters/postgres-client';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { inspectPublicMediaArticle } from '@/lib/public-media-content-policy';

type Result = { success: true; id?: string } | { success: false; error: string };

export async function scheduleSocialPublication(input: {
  channelId: string; contentText: string; articleId?: string; mediaAssetIds?: string[]; linkUrl?: string; scheduledAt: string; idempotencyKey: string; publicContentConfirmed: boolean;
}): Promise<Result> {
  const authorization = await authorizeMediaEditorialAction('social');
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(input?.channelId || '')) return { success: false, error: 'Choose a valid social channel.' };
  if (!/^[0-9a-f-]{36}$/i.test(input?.idempotencyKey || '')) return { success: false, error: 'Invalid social request key. Retry the compose action.' };
  if (input.publicContentConfirmed !== true) return { success: false, error: 'Confirm that this post is suitable for public Factsport Media distribution.' };
  try {
    const content = typeof input.contentText === 'string' ? input.contentText.trim() : '';
    if (!content || content.length > 10000) return { success: false, error: 'Post text must be between 1 and 10,000 characters.' };
    const scheduledAt = new Date(input.scheduledAt);
    if (!Number.isFinite(scheduledAt.valueOf()) || scheduledAt.valueOf() < Date.now() + 30_000) return { success: false, error: 'Choose a future time at least 30 seconds from now.' };
    let linkUrl: string | null = null;
    if (input.linkUrl?.trim()) {
      const parsed = new URL(input.linkUrl.trim());
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return { success: false, error: 'Post links must use HTTP or HTTPS.' };
      linkUrl = parsed.toString();
    }
    const contentPolicy = inspectPublicMediaArticle({ title: content, body_markdown: content, canonical_url: linkUrl });
    if (!contentPolicy.eligible) return { success: false, error: 'This post contains betting promotion, an affiliate link or private Prediction content and cannot be distributed through public Media channels.' };
    if (input.articleId && !/^[0-9a-f-]{36}$/i.test(input.articleId)) return { success: false, error: 'Invalid linked article.' };
    const mediaAssetIds = Array.isArray(input.mediaAssetIds) ? Array.from(new Set(input.mediaAssetIds)) : [];
    if (mediaAssetIds.length > 4 || mediaAssetIds.some(id => !/^[0-9a-f-]{36}$/i.test(id))) {
      return { success: false, error: 'Choose up to four valid public media assets.' };
    }

    const id = await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const actorId = authorization.user.domainUserId;
      const channels = await tx`SELECT id, supports_media FROM public.media_social_channels WHERE id=${input.channelId}::uuid AND is_enabled=true AND surface_scope='public_media' FOR SHARE`;
      if (!channels.length) throw new Error('This social channel is not enabled for publishing.');
      if (mediaAssetIds.length && !channels[0].supports_media) throw new Error('This channel has not passed image-delivery verification; schedule a text-only post or use a verified image-capable channel.');
      if (input.articleId) {
        const articles = await tx`
          SELECT id FROM public.editorial_articles
          WHERE id=${input.articleId}::uuid AND status='published' AND review_status='approved'
          LIMIT 1
        `;
        if (!articles.length) throw new Error('Linked article must already be published and approved.');
      }
      if (mediaAssetIds.length) {
        const eligibleAssets = await tx`
          SELECT m.id
          FROM public.media_assets m
          WHERE m.id = ANY(${mediaAssetIds}::uuid[])
            AND m.media_kind='image'
            AND m.is_public=true
            AND m.rights_status IN ('owned','licensed','editorial_exception')
            AND m.rights_reviewed_by IS NOT NULL AND m.rights_reviewed_at IS NOT NULL
            AND (m.usage_expires_at IS NULL OR m.usage_expires_at > now())
            AND (EXISTS (
              SELECT 1 FROM public.editorial_article_media am
              JOIN public.editorial_articles a ON a.id=am.article_id
              WHERE am.media_id=m.id AND a.status='published' AND a.review_status='approved'
                AND a.reviewed_by IS NOT NULL AND a.reviewed_at IS NOT NULL AND a.published_at <= now()
            ) OR EXISTS (
              SELECT 1 FROM public.editorial_article_team_media tm
              JOIN public.editorial_articles a ON a.id=tm.article_id
              WHERE tm.media_id=m.id AND a.status='published' AND a.review_status='approved'
                AND a.reviewed_by IS NOT NULL AND a.reviewed_at IS NOT NULL AND a.published_at <= now()
            ))
          FOR SHARE OF m
        `;
        if (eligibleAssets.length !== mediaAssetIds.length) {
          throw new Error('Every social image must already be rights-approved and attached to public published Media content.');
        }
      }
      const matchesRequest = (row: any) =>
        row.created_by === actorId &&
        row.channel_id === input.channelId &&
        (row.article_id || null) === (input.articleId || null) &&
        JSON.stringify(row.media_asset_ids || []) === JSON.stringify(mediaAssetIds) &&
        row.content_text === content &&
        (row.link_url || null) === linkUrl &&
        new Date(row.scheduled_at).valueOf() === scheduledAt.valueOf();
      const existing = await tx`
        SELECT id, article_id, channel_id, media_asset_ids, content_text, link_url, scheduled_at, created_by
        FROM public.media_social_publications
        WHERE idempotency_key=${input.idempotencyKey} FOR UPDATE
      `;
      if (existing.length) {
        if (!matchesRequest(existing[0])) throw new Error('This social request key was already used for a different post.');
        return existing[0].id as string;
      }
      const publication = await tx`
        INSERT INTO public.media_social_publications (
          article_id, channel_id, content_text, media_asset_ids, link_url, status, scheduled_at,
          idempotency_key, created_by, updated_by, distribution_scope,
          public_content_confirmed_by, public_content_confirmed_at
        ) VALUES (
          ${input.articleId || null}::uuid, ${input.channelId}::uuid, ${content}, ${mediaAssetIds}::uuid[], ${linkUrl},
          'scheduled', ${scheduledAt.toISOString()}::timestamptz, ${input.idempotencyKey},
          ${actorId}::uuid, ${actorId}::uuid, 'public_media', ${actorId}::uuid, now()
        ) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id
      `;
      if (!publication.length) {
        const raced = await tx`
          SELECT id, article_id, channel_id, media_asset_ids, content_text, link_url, scheduled_at, created_by
          FROM public.media_social_publications
          WHERE idempotency_key=${input.idempotencyKey} FOR UPDATE
        `;
        if (!raced.length || !matchesRequest(raced[0])) throw new Error('Social scheduling idempotency conflict. Retry with a new compose request.');
        return raced[0].id as string;
      }
      await tx`
        INSERT INTO public.media_social_outbox (publication_id, status, available_at)
        VALUES (${publication[0].id}::uuid, 'pending', ${scheduledAt.toISOString()}::timestamptz)
      `;
      await tx`
        INSERT INTO public.media_editorial_audit_events (actor_user_id, action, article_id, details)
        VALUES (
          ${actorId}::uuid, 'social_scheduled', ${input.articleId || null}::uuid,
          ${JSON.stringify({ publicationId: publication[0].id, channelId: input.channelId, scheduledAt: scheduledAt.toISOString(), distributionScope: 'public_media', publicContentConfirmed: true })}::jsonb
        )
      `;
      return publication[0].id as string;
    }));
    revalidatePath('/admin/social');
    return { success: true, id };
  } catch (error) {
    console.error('Social scheduling failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to schedule social post.' };
  }
}

export async function cancelSocialPublication(publicationId: string): Promise<Result> {
  const authorization = await authorizeMediaEditorialAction('social');
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(publicationId)) return { success: false, error: 'Invalid social post identifier.' };
  try {
    await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const actorId = authorization.user.domainUserId;
      const outbox = await tx`
        SELECT id, status FROM public.media_social_outbox
        WHERE publication_id=${publicationId}::uuid FOR UPDATE
      `;
      if (!outbox.length || !['pending', 'retry'].includes(outbox[0].status)) {
        throw new Error('This post is already being delivered or has completed; cancellation is no longer safe.');
      }
      const rows = await tx`
        UPDATE public.media_social_publications
        SET status='cancelled', updated_by=${actorId}::uuid, updated_at=now()
        WHERE id=${publicationId}::uuid AND status IN ('draft','scheduled','queued') RETURNING id
      `;
      if (!rows.length) throw new Error('Only draft or scheduled posts can be cancelled.');
      await tx`
        UPDATE public.media_social_outbox SET status='cancelled', lease_owner=NULL,
          lease_expires_at=NULL, updated_at=now()
        WHERE id=${outbox[0].id}::uuid
      `;
      await tx`
        INSERT INTO public.media_editorial_audit_events (actor_user_id, action, details)
        VALUES (${actorId}::uuid, 'social_cancelled', ${JSON.stringify({ publicationId })}::jsonb)
      `;
    }));
    revalidatePath('/admin/social');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to cancel social post.' };
  }
}


export async function updateSocialChannel(input: {
  channelId: string;
  isEnabled: boolean;
  supportsMedia: boolean;
  providerSetting: string;
}): Promise<Result> {
  const authorization = await authorizeMediaEditorialAction('social_admin');
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(input?.channelId || '') ||
      typeof input.isEnabled !== 'boolean' || typeof input.supportsMedia !== 'boolean') {
    return { success: false, error: 'Invalid social channel configuration.' };
  }
  try {
    await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const rows = await tx`
        SELECT id, provider FROM public.media_social_channels
        WHERE id=${input.channelId}::uuid
        FOR UPDATE
      `;
      if (!rows.length) throw new Error('Social channel was not found.');
      const provider = rows[0].provider as FactsportSocialProvider;
      if (!['meta', 'telegram', 'buffer', 'make'].includes(provider)) {
        throw new Error('This social provider has no approved V2 adapter mapping.');
      }
      if (input.isEnabled && (!isFactsportSocialDispatchReady() || !isFactsportSocialProviderReady(provider))) {
        throw new Error('Channel activation is blocked until the Logic Apps dispatcher and this provider adapter pass staging readiness checks.');
      }
      if (input.supportsMedia && !isFactsportSocialMediaProviderReady(provider)) {
        throw new Error('Image delivery is disabled until this provider has passed private image-delivery E2E.');
      }

      const raw = typeof input.providerSetting === 'string' ? input.providerSetting.trim() : '';
      if ((input.isEnabled || input.supportsMedia) && !raw) throw new Error('Set the non-secret account routing identifier before enabling this channel.');
      let settings: Record<string, unknown> = {};
      if (provider === 'meta') {
        if (raw && !/^\d{5,30}$/.test(raw)) throw new Error('Enter a numeric Meta Page ID; never enter a page access token here.');
        settings = raw ? { page_id: raw } : {};
      } else if (provider === 'buffer') {
        if (raw && !/^[A-Za-z0-9_-]{1,200}$/.test(raw)) throw new Error('Enter the Buffer channel/profile ID, not an access token.');
        settings = raw ? { profile_id: raw } : {};
      } else if (provider === 'telegram') {
        const chatIds = raw.split(',').map(value => value.trim()).filter(Boolean);
        if (chatIds.length > 20 || chatIds.some(value => !/^(?:-?\d{1,20}|@[A-Za-z0-9_]{5,32})$/.test(value))) {
          throw new Error('Enter up to 20 Telegram chat IDs or @channel usernames, separated by commas.');
        }
        settings = chatIds.length ? { chat_ids: chatIds } : {};
      } else if (provider === 'make') {
        if (raw && !/^[A-Za-z0-9_-]{1,80}$/.test(raw)) throw new Error('Enter a non-secret Make route key, not a webhook URL.');
        settings = raw ? { route_key: raw } : {};
      }

      await tx`
        UPDATE public.media_social_channels
        SET is_enabled=${input.isEnabled},
            supports_media=${input.supportsMedia},
            settings=${JSON.stringify(settings)}::jsonb,
            updated_at=now()
        WHERE id=${input.channelId}::uuid
      `;
      await tx`
        INSERT INTO public.media_editorial_audit_events (actor_user_id, action, details)
        VALUES (
          ${authorization.user.domainUserId}::uuid, 'social_channel_configured',
          ${JSON.stringify({ channelId: input.channelId, provider, enabled: input.isEnabled, supportsMedia: input.supportsMedia })}::jsonb
        )
      `;
      return true;
    }));
    revalidatePath('/admin/social');
    return { success: true };
  } catch (error) {
    console.error('Social channel configuration failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to update social channel.' };
  }
}
