'use server';

import { revalidatePath } from 'next/cache';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { authorizeAdminAction } from '@/app/lib/admin/authorization';

type Result = { success: true; id?: string } | { success: false; error: string };

async function getActorId(tx: any, authId: string): Promise<string> {
  const actors = await tx\`
    SELECT user_id FROM public.external_identities
    WHERE subject=\${authId} ORDER BY created_at DESC LIMIT 2
  \`;
  if (actors.length !== 1) throw new Error('This administrator has no unique Factsport domain identity mapping.');
  return actors[0].user_id as string;
}

export async function scheduleSocialPublication(input: {
  channelId: string; contentText: string; articleId?: string; linkUrl?: string; scheduledAt: string;
}): Promise<Result> {
  const authorization = await authorizeAdminAction();
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(input?.channelId || '')) return { success: false, error: 'Choose a valid social channel.' };
  try {
    const content = typeof input.contentText === 'string' ? input.contentText.trim() : '';
    if (!content || content.length > 10000) return { success: false, error: 'Post text must be between 1 and 10,000 characters.' };
    const scheduledAt = new Date(input.scheduledAt);
    if (!Number.isFinite(scheduledAt.valueOf()) || scheduledAt.valueOf() < Date.now() + 30_000) {
      return { success: false, error: 'Choose a future time at least 30 seconds from now.' };
    }
    let linkUrl: string | null = null;
    if (input.linkUrl?.trim()) {
      const parsed = new URL(input.linkUrl.trim());
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return { success: false, error: 'Post links must use HTTP or HTTPS.' };
      linkUrl = parsed.toString();
    }
    if (input.articleId && !/^[0-9a-f-]{36}$/i.test(input.articleId)) return { success: false, error: 'Invalid linked article.' };

    const id = await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const actorId = await getActorId(tx, authorization.user.id);
      const channels = await tx\`SELECT id FROM public.media_social_channels WHERE id=\${input.channelId}::uuid AND is_enabled=true FOR SHARE\`;
      if (!channels.length) throw new Error('This social channel is not enabled for publishing.');
      if (input.articleId) {
        const articles = await tx\`
          SELECT id FROM public.editorial_articles
          WHERE id=\${input.articleId}::uuid AND status='published' AND review_status='approved'
          LIMIT 1
        \`;
        if (!articles.length) throw new Error('Linked article must already be published and approved.');
      }
      const publication = await tx\`
        INSERT INTO public.media_social_publications (
          article_id, channel_id, content_text, link_url, status, scheduled_at,
          idempotency_key, created_by, updated_by
        ) VALUES (
          \${input.articleId || null}::uuid, \${input.channelId}::uuid, \${content}, \${linkUrl},
          'scheduled', \${scheduledAt.toISOString()}::timestamptz, \${crypto.randomUUID()},
          \${actorId}::uuid, \${actorId}::uuid
        ) RETURNING id
      \`;
      await tx\`
        INSERT INTO public.media_social_outbox (publication_id, status, available_at)
        VALUES (\${publication[0].id}::uuid, 'pending', \${scheduledAt.toISOString()}::timestamptz)
      \`;
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
  const authorization = await authorizeAdminAction();
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(publicationId)) return { success: false, error: 'Invalid social post identifier.' };
  try {
    await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const actorId = await getActorId(tx, authorization.user.id);
      const rows = await tx\`
        UPDATE public.media_social_publications
        SET status='cancelled', updated_by=\${actorId}::uuid, updated_at=now()
        WHERE id=\${publicationId}::uuid AND status IN ('draft','scheduled','queued') RETURNING id
      \`;
      if (!rows.length) throw new Error('Only draft or scheduled posts can be cancelled.');
      await tx\`
        UPDATE public.media_social_outbox SET status='cancelled', lease_owner=NULL,
          lease_expires_at=NULL, updated_at=now()
        WHERE publication_id=\${publicationId}::uuid AND status IN ('pending','retry')
      \`;
    }));
    revalidatePath('/admin/social');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to cancel social post.' };
  }
}
