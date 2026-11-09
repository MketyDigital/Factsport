'use server';

import { revalidatePath } from 'next/cache';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';

type MediaReviewInput = {
  articleId: string; assetId: string; placement: 'hero' | 'team_1' | 'team_2' | 'inline'; position?: number;
  rightsStatus: 'owned' | 'licensed' | 'editorial_exception';
  rightsReference?: string; attributionText?: string; altText?: string; usageExpiresAt?: string;
};

export async function reviewRightsAndAttachMedia(input: MediaReviewInput) {
  const authorization = await authorizeMediaEditorialAction('media');
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(input?.articleId || '') || !/^[0-9a-f-]{36}$/i.test(input?.assetId || '')) {
    return { success: false, error: 'Invalid article or media asset identifier.' };
  }
  if (!['hero', 'team_1', 'team_2', 'inline'].includes(input.placement) ||
      !['owned', 'licensed', 'editorial_exception'].includes(input.rightsStatus)) {
    return { success: false, error: 'Invalid media placement or rights status.' };
  }
  const position = input.placement === 'inline' && Number.isInteger(input.position) ? Math.max(0, Math.min(input.position!, 100)) : 0;
  if (input.placement === 'inline' && (!Number.isInteger(input.position) || input.position! < 0 || input.position! > 100)) {
    return { success: false, error: 'Inline media position must be a whole number from 0 to 100.' };
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
          updated_at=now()
        WHERE id=${input.assetId}::uuid
      `;

      await tx`
        INSERT INTO public.editorial_article_revision_media
          (revision_id, placement, position, media_id, remove_media, updated_at)
        VALUES (${revisions[0].id}::uuid, ${input.placement}, ${position}, ${input.assetId}::uuid, false, now())
        ON CONFLICT (revision_id, placement, position) DO UPDATE SET
          media_id=EXCLUDED.media_id, remove_media=false, updated_at=now()
      `;
      await tx`
        INSERT INTO public.media_editorial_audit_events
          (actor_user_id, action, article_id, revision_id, details)
        VALUES (
          ${actorId}::uuid, 'media_rights_reviewed', ${input.articleId}::uuid,
          ${revisions[0].id}::uuid,
          ${JSON.stringify({ assetId: input.assetId, placement: input.placement, rightsStatus: input.rightsStatus })}::jsonb
        )
      `;
    }));
    revalidatePath('/admin/news');
    return { success: true };
  } catch (error) {
    console.error('Editorial media rights review failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to review and attach media.' };
  }
}


export async function removeRevisionMedia(input: {
  articleId: string; placement: 'hero' | 'team_1' | 'team_2' | 'inline'; position?: number;
}) {
  const authorization = await authorizeMediaEditorialAction('media');
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(input?.articleId || '') ||
      !['hero', 'team_1', 'team_2', 'inline'].includes(input?.placement)) {
    return { success: false, error: 'Invalid article or media placement.' };
  }
  const position = input.placement === 'inline' ? (input.position ?? 0) : 0;
  if (!Number.isInteger(position) || (position as number) < 0 || (position as number) > 100 ||
      (input.placement !== 'inline' && position !== 0)) {
    return { success: false, error: 'Invalid media position.' };
  }
  try {
    await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const articles = await tx`
        SELECT id FROM public.editorial_articles
        WHERE id=${input.articleId}::uuid AND status <> 'archived'
        FOR UPDATE
      `;
      if (!articles.length) throw new Error('Article was not found or has been archived.');
      const revisions = await tx`
        SELECT id FROM public.editorial_article_revisions
        WHERE article_id=${input.articleId}::uuid AND workflow_status='draft'
        ORDER BY revision_number DESC LIMIT 1 FOR UPDATE
      `;
      if (!revisions.length) throw new Error('Save a draft revision before removing media.');
      await tx`
        INSERT INTO public.editorial_article_revision_media
          (revision_id, placement, position, media_id, remove_media, updated_at)
        VALUES (${revisions[0].id}::uuid, ${input.placement}, ${position}, NULL, true, now())
        ON CONFLICT (revision_id, placement, position) DO UPDATE SET
          media_id=NULL, remove_media=true, updated_at=now()
      `;
      await tx`
        INSERT INTO public.media_editorial_audit_events
          (actor_user_id, action, article_id, revision_id, details)
        VALUES (
          ${authorization.user.domainUserId}::uuid, 'media_detached',
          ${input.articleId}::uuid, ${revisions[0].id}::uuid,
          ${JSON.stringify({ placement: input.placement, position })}::jsonb
        )
      `;
    }));
    revalidatePath('/admin/news');
    return { success: true };
  } catch (error) {
    console.error('Editorial media removal failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to remove media from this revision.' };
  }
}


export async function revokeMediaRights(input: { assetId: string; reason: string }) {
  const authorization = await authorizeMediaEditorialAction('rights_admin');
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(input?.assetId || '')) {
    return { success: false, error: 'Invalid media asset identifier.' };
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 500) : '';
  if (reason.length < 10) return { success: false, error: 'Record at least 10 characters explaining why this asset is being withdrawn.' };
  try {
    const affectedSlugs = await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const assets = await tx`
        SELECT id, rights_status, is_public
        FROM public.media_assets
        WHERE id=${input.assetId}::uuid AND media_kind='image'
        FOR UPDATE
      `;
      if (!assets.length) throw new Error('Media asset was not found.');
      if (assets[0].rights_status === 'rejected') throw new Error('This asset has already been withdrawn.');
      const linkedArticles = await tx`
        WITH affected_assets AS (
          SELECT ${input.assetId}::uuid AS id
          UNION
          SELECT derivative_asset_id FROM public.media_asset_derivatives
          WHERE source_asset_id=${input.assetId}::uuid
        )
        SELECT DISTINCT a.slug
        FROM public.editorial_articles a
        WHERE EXISTS (
          SELECT 1 FROM public.editorial_article_media am
          JOIN affected_assets aa ON aa.id=am.media_id
          WHERE am.article_id=a.id
        ) OR EXISTS (
          SELECT 1 FROM public.editorial_article_team_media tm
          JOIN affected_assets aa ON aa.id=tm.media_id
          WHERE tm.article_id=a.id
        )
      `;
      await tx`
        UPDATE public.media_assets
        SET rights_status='rejected', is_public=false,
            rights_reviewed_by=${authorization.user.domainUserId}::uuid,
            rights_reviewed_at=now(), updated_at=now()
        WHERE id=${input.assetId}::uuid
      `;
      await tx`
        INSERT INTO public.media_editorial_audit_events (actor_user_id, action, details)
        VALUES (
          ${authorization.user.domainUserId}::uuid, 'media_rights_revoked',
          ${JSON.stringify({
            assetId: input.assetId,
            previousRightsStatus: assets[0].rights_status,
            wasPublic: assets[0].is_public,
            reason,
          })}::jsonb
        )
      `;
      return linkedArticles.map(article => String((article as any).slug));
    }));
    revalidatePath('/admin/media');
    revalidatePath('/admin/news');
    revalidatePath('/news');
    revalidatePath('/');
    for (const slug of affectedSlugs) revalidatePath('/news/' + slug);
    return { success: true };
  } catch (error) {
    console.error('Media rights revocation failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to withdraw media rights.' };
  }
}
