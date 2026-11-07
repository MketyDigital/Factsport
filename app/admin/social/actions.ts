'use server';

import { revalidatePath } from 'next/cache';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';

type Result = { success: true; id?: string } | { success: false; error: string };

export async function scheduleSocialPublication(input: {
  channelId: string; contentText: string; articleId?: string; linkUrl?: string; scheduledAt: string; idempotencyKey: string; publicContentConfirmed: boolean;
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
    if (input.articleId && !/^[0-9a-f-]{36}$/i.test(input.articleId)) return { success: false, error: 'Invalid linked article.' };

    const id = await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const actorId = authorization.user.domainUserId;
      const channels = await tx`SELECT id FROM public.media_social_channels WHERE id=${input.channelId}::uuid AND is_enabled=true AND surface_scope='public_media' FOR SHARE`;
      if (!channels.length) throw new Error('This social channel is not enabled for publishing.');
      if (input.articleId) {
        const articles = await tx`
          SELECT id FROM public.editorial_articles
          WHERE id=${input.articleId}::uuid AND status='published' AND review_status='approved'
          LIMIT 1
        `;
        if (!articles.length) throw new Error('Linked article must already be published and approved.');
      }
      const matchesRequest = (row: any) =>
        row.created_by === actorId &&
        row.channel_id === input.channelId &&
        (row.article_id || null) === (input.articleId || null) &&
        row.content_text === content &&
        (row.link_url || null) === linkUrl &&
        new Date(row.scheduled_at).valueOf() === scheduledAt.valueOf();
      const existing = await tx`
        SELECT id, article_id, channel_id, content_text, link_url, scheduled_at, created_by
        FROM public.media_social_publications
        WHERE idempotency_key=${input.idempotencyKey} FOR UPDATE
      `;
      if (existing.length) {
        if (!matchesRequest(existing[0])) throw new Error('This social request key was already used for a different post.');
        return existing[0].id as string;
      }
      const publication = await tx`
        INSERT INTO public.media_social_publications (
          article_id, channel_id, content_text, link_url, status, scheduled_at,
          idempotency_key, created_by, updated_by, distribution_scope,
          public_content_confirmed_by, public_content_confirmed_at
        ) VALUES (
          ${input.articleId || null}::uuid, ${input.channelId}::uuid, ${content}, ${linkUrl},
          'scheduled', ${scheduledAt.toISOString()}::timestamptz, ${input.idempotencyKey},
          ${actorId}::uuid, ${actorId}::uuid, 'public_media', ${actorId}::uuid, now()
        ) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id
      `;
      if (!publication.length) {
        const raced = await tx`
          SELECT id, article_id, channel_id, content_text, link_url, scheduled_at, created_by
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
