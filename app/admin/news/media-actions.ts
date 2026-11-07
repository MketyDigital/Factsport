'use server';

import { revalidatePath } from 'next/cache';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { authorizeAdminAction } from '@/app/lib/admin/authorization';

type MediaReviewInput = {
  articleId: string; assetId: string; placement: 'hero' | 'team_1' | 'team_2';
  rightsStatus: 'owned' | 'licensed' | 'editorial_exception';
  rightsReference?: string; attributionText?: string; altText?: string; usageExpiresAt?: string;
};

export async function reviewRightsAndAttachMedia(input: MediaReviewInput) {
  const authorization = await authorizeAdminAction();
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(input?.articleId || '') || !/^[0-9a-f-]{36}$/i.test(input?.assetId || '')) {
    return { success: false, error: 'Invalid article or media asset identifier.' };
  }
  if (!['hero', 'team_1', 'team_2'].includes(input.placement) ||
      !['owned', 'licensed', 'editorial_exception'].includes(input.rightsStatus)) {
    return { success: false, error: 'Invalid media placement or rights status.' };
  }
  const rightsReference = typeof input.rightsReference === 'string' ? input.rightsReference.trim().slice(0, 2048) : '';
  if (input.rightsStatus !== 'owned' && !rightsReference) {
    return { success: false, error: 'Licensed and editorial-exception media require a rights reference.' };
  }
  const expiry = input.usageExpiresAt ? new Date(input.usageExpiresAt) : null;
  if (expiry && (!Number.isFinite(expiry.valueOf()) || expiry.valueOf() <= Date.now())) {
    return { success: false, error: 'Media usage expiry must be a future date.' };
  }

  try {
    await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const actors = await tx`
        SELECT user_id FROM public.external_identities
        WHERE subject=${authorization.user.id} ORDER BY created_at DESC LIMIT 2
      `;
      if (actors.length !== 1) throw new Error('This administrator has no unique Factsport domain identity mapping.');
      const actorId = actors[0].user_id as string;

      const articles = await tx`
        SELECT id, status FROM public.editorial_articles
        WHERE id=${input.articleId}::uuid FOR UPDATE
      `;
      if (!articles.length || articles[0].status !== 'draft') {
        throw new Error('Attach or replace media while the article is a draft. Published content requires a reviewed revision.');
      }
      const assets = await tx`
        SELECT id, media_kind FROM public.media_assets WHERE id=${input.assetId}::uuid FOR UPDATE
      `;
      if (!assets.length || assets[0].media_kind !== 'image') throw new Error('Image asset was not found.');

      await tx`
        UPDATE public.media_assets SET
          rights_status=${input.rightsStatus},
          rights_reference=${rightsReference || null},
          attribution_text=${typeof input.attributionText === 'string' ? input.attributionText.trim().slice(0, 500) || null : null},
          alt_text=${typeof input.altText === 'string' ? input.altText.trim().slice(0, 500) || null : null},
          usage_expires_at=${expiry ? expiry.toISOString() : null}::timestamptz,
          rights_reviewed_by=${actorId}::uuid,
          rights_reviewed_at=now(),
          is_public=true,
          updated_at=now()
        WHERE id=${input.assetId}::uuid
      `;

      if (input.placement === 'hero') {
        const existing = await tx`
          SELECT article_id FROM public.editorial_article_media
          WHERE article_id=${input.articleId}::uuid AND placement='hero' FOR UPDATE
        `;
        if (existing.length) {
          await tx`
            UPDATE public.editorial_article_media SET media_id=${input.assetId}::uuid, position=0
            WHERE article_id=${input.articleId}::uuid AND placement='hero'
          `;
        } else {
          await tx`
            INSERT INTO public.editorial_article_media (article_id, media_id, placement, position)
            VALUES (${input.articleId}::uuid, ${input.assetId}::uuid, 'hero', 0)
          `;
        }
      } else {
        await tx`
          INSERT INTO public.editorial_article_team_media (article_id, team_side, media_id)
          VALUES (${input.articleId}::uuid, ${input.placement}, ${input.assetId}::uuid)
          ON CONFLICT (article_id, team_side) DO UPDATE SET media_id=EXCLUDED.media_id
        `;
      }
    }));
    revalidatePath('/admin/news');
    revalidatePath('/news');
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Editorial media rights review failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to review and attach media.' };
  }
}
