'use server';

import { revalidatePath } from 'next/cache';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';

type MediaReviewInput = {
  articleId: string; assetId: string; placement: 'hero' | 'team_1' | 'team_2';
  rightsStatus: 'owned' | 'licensed' | 'editorial_exception';
  rightsReference?: string; attributionText?: string; altText?: string; usageExpiresAt?: string;
};

export async function reviewRightsAndAttachMedia(input: MediaReviewInput) {
  const authorization = await authorizeMediaEditorialAction('media');
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
      const actorId = authorization.user.domainUserId;

      const articles = await tx`
        SELECT id, status FROM public.editorial_articles
        WHERE id=${input.articleId}::uuid FOR UPDATE
      `;
      if (!articles.length || articles[0].status === 'archived') throw new Error('Article was not found or has been archived.');

      const revisions = await tx`
        SELECT id FROM public.editorial_article_revisions
        WHERE article_id=${input.articleId}::uuid AND workflow_status='draft'
        ORDER BY revision_number DESC LIMIT 1 FOR UPDATE
      `;
      if (!revisions.length) throw new Error('Save a draft revision before attaching or replacing media.');

      const assets = await tx`
        SELECT id, media_kind, rights_status FROM public.media_assets
        WHERE id=${input.assetId}::uuid FOR UPDATE
      `;
      if (!assets.length || assets[0].media_kind !== 'image') throw new Error('Image asset was not found.');
      if (assets[0].rights_status === 'rejected' || assets[0].rights_status === 'expired') {
        throw new Error('Rejected or expired media cannot be approved for editorial use.');
      }

      await tx`
        UPDATE public.media_assets SET
          rights_status=${input.rightsStatus},
          rights_reference=${rightsReference || null},
          attribution_text=${typeof input.attributionText === 'string' ? input.attributionText.trim().slice(0, 500) || null : null},
          alt_text=${typeof input.altText === 'string' ? input.altText.trim().slice(0, 500) || null : null},
          usage_expires_at=${expiry ? expiry.toISOString() : null}::timestamptz,
          rights_reviewed_by=${actorId}::uuid,
          rights_reviewed_at=now(),
          is_public=false,
          updated_at=now()
        WHERE id=${input.assetId}::uuid
      `;

      await tx`
        INSERT INTO public.editorial_article_revision_media
          (revision_id, placement, media_id, remove_media, updated_at)
        VALUES (${revisions[0].id}::uuid, ${input.placement}, ${input.assetId}::uuid, false, now())
        ON CONFLICT (revision_id, placement) DO UPDATE SET
          media_id=EXCLUDED.media_id, remove_media=false, updated_at=now()
      `;
    }));
    revalidatePath('/admin/news');
    return { success: true };
  } catch (error) {
    console.error('Editorial media rights review failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to review and attach media.' };
  }
}
