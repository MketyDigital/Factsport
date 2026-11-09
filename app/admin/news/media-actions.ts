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
  const altText = typeof input.altText === 'string' ? input.altText.trim().slice(0, 240) : '';
  if ((input.placement === 'hero' || input.placement === 'inline') && altText.length < 3) {
    return { success: false, error: 'Hero and inline images require descriptive alt text.' };
  }
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
          alt_text=${altText || null},
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


export async function reviewRightsAndAttachVideo(input: {
  articleId: string; videoId: string; position?: number;
  rightsStatus: 'owned' | 'licensed' | 'editorial_exception';
  rightsReference?: string; attributionText?: string; usageExpiresAt?: string;
}) {
  const authorization = await authorizeMediaEditorialAction('media');
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(input?.articleId || '') || !/^[0-9a-f-]{36}$/i.test(input?.videoId || '') ||
      !['owned','licensed','editorial_exception'].includes(input.rightsStatus)) {
    return { success: false, error: 'Invalid article, video or rights status.' };
  }
  const position = input.position ?? 0;
  if (!Number.isInteger(position) || position < 0 || position > 100) {
    return { success: false, error: 'Video position must be a whole number from 0 to 100.' };
  }
  const rightsReference = typeof input.rightsReference === 'string' ? input.rightsReference.trim().slice(0, 2048) : '';
  if (input.rightsStatus !== 'owned' && !rightsReference) {
    return { success: false, error: 'Licensed and editorial-exception videos require a rights reference.' };
  }
  const expiry = input.usageExpiresAt ? new Date(input.usageExpiresAt) : null;
  if (expiry && (!Number.isFinite(expiry.valueOf()) || expiry.valueOf() <= Date.now())) {
    return { success: false, error: 'Video usage expiry must be a future date.' };
  }
  try {
    await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
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
      if (!revisions.length) throw new Error('Save a draft revision before attaching a video.');
      const videos = await tx`
        SELECT id, upload_status, rights_status, playback_host FROM public.media_video_assets
        WHERE id=${input.videoId}::uuid FOR UPDATE
      `;
      if (!videos.length || videos[0].upload_status !== 'ready' || !videos[0].playback_host) {
        throw new Error('Only fully processed Cloudflare Stream videos can be attached.');
      }
      if (videos[0].rights_status === 'rejected' || videos[0].rights_status === 'expired') {
        throw new Error('Rejected or expired video rights cannot be approved.');
      }
      await tx`
        UPDATE public.media_video_assets SET
          rights_status=${input.rightsStatus},
          rights_reference=${rightsReference || null},
          attribution_text=${typeof input.attributionText === 'string' ? input.attributionText.trim().slice(0, 500) || null : null},
          usage_expires_at=${expiry ? expiry.toISOString() : null}::timestamptz,
          rights_reviewed_by=${authorization.user.domainUserId}::uuid,
          rights_reviewed_at=now(), updated_at=now()
        WHERE id=${input.videoId}::uuid
      `;
      await tx`
        INSERT INTO public.editorial_article_revision_videos
          (revision_id, position, video_id, remove_video, updated_at)
        VALUES (${revisions[0].id}::uuid, ${position}, ${input.videoId}::uuid, false, now())
        ON CONFLICT (revision_id, position) DO UPDATE SET
          video_id=EXCLUDED.video_id, remove_video=false, updated_at=now()
      `;
      await tx`
        INSERT INTO public.media_editorial_audit_events
          (actor_user_id, action, article_id, revision_id, details)
        VALUES (
          ${authorization.user.domainUserId}::uuid, 'media_video_rights_reviewed',
          ${input.articleId}::uuid, ${revisions[0].id}::uuid,
          ${JSON.stringify({ videoId: input.videoId, position, rightsStatus: input.rightsStatus })}::jsonb
        )
      `;
      await tx`
        INSERT INTO public.media_editorial_audit_events
          (actor_user_id, action, article_id, revision_id, details)
        VALUES (
          ${authorization.user.domainUserId}::uuid, 'media_video_attached',
          ${input.articleId}::uuid, ${revisions[0].id}::uuid,
          ${JSON.stringify({ videoId: input.videoId, position })}::jsonb
        )
      `;
    }));
    revalidatePath('/admin/media'); revalidatePath('/admin/news');
    return { success: true };
  } catch (error) {
    console.error('Video rights review and attachment failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to review and attach video.' };
  }
}

export async function removeEditorialVideoFromRevision(input: { articleId: string; position: number }) {
  const authorization = await authorizeMediaEditorialAction('media');
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(input?.articleId || '') ||
      !Number.isInteger(input.position) || input.position < 0 || input.position > 100) {
    return { success: false, error: 'Invalid article or video position.' };
  }
  try {
    await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const revisions = await tx`
        SELECT id FROM public.editorial_article_revisions
        WHERE article_id=${input.articleId}::uuid AND workflow_status='draft'
        ORDER BY revision_number DESC LIMIT 1 FOR UPDATE
      `;
      if (!revisions.length) throw new Error('Save a draft revision before removing a video.');
      const existing = await tx`
        SELECT video_id FROM public.editorial_article_revision_videos
        WHERE revision_id=${revisions[0].id}::uuid AND position=${input.position}
        FOR UPDATE
      `;
      if (!existing.length) throw new Error('No video is attached at this position.');
      await tx`
        INSERT INTO public.editorial_article_revision_videos
          (revision_id, position, video_id, remove_video, updated_at)
        VALUES (${revisions[0].id}::uuid, ${input.position}, NULL, true, now())
        ON CONFLICT (revision_id, position) DO UPDATE SET
          video_id=NULL, remove_video=true, updated_at=now()
      `;
      await tx`
        INSERT INTO public.media_editorial_audit_events
          (actor_user_id, action, article_id, revision_id, details)
        VALUES (
          ${authorization.user.domainUserId}::uuid, 'media_video_detached',
          ${input.articleId}::uuid, ${revisions[0].id}::uuid,
          ${JSON.stringify({ position: input.position, videoId: existing[0].video_id })}::jsonb
        )
      `;
    }));
    revalidatePath('/admin/news');
    return { success: true };
  } catch (error) {
    console.error('Editorial video detachment failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to remove video.' };
  }
}


export async function revokeMediaVideoRights(input: { videoId: string; reason: string }) {
  const authorization = await authorizeMediaEditorialAction('rights_admin');
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(input?.videoId || '')) {
    return { success: false, error: 'Invalid video asset identifier.' };
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 500) : '';
  if (reason.length < 10) return { success: false, error: 'Record at least 10 characters explaining why this video is being withdrawn.' };
  try {
    const affectedSlugs = await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const videos = await tx`
        SELECT id, rights_status, is_public
        FROM public.media_video_assets
        WHERE id=${input.videoId}::uuid FOR UPDATE
      `;
      if (!videos.length) throw new Error('Video asset was not found.');
      if (videos[0].rights_status === 'rejected') throw new Error('This video has already been withdrawn.');
      const linkedArticles = await tx`
        SELECT DISTINCT a.slug
        FROM public.editorial_article_videos av
        JOIN public.editorial_articles a ON a.id=av.article_id
        WHERE av.video_id=${input.videoId}::uuid
      `;
      await tx`
        UPDATE public.media_video_assets
        SET rights_status='rejected', is_public=false,
            rights_reviewed_by=${authorization.user.domainUserId}::uuid,
            rights_reviewed_at=now(), updated_at=now()
        WHERE id=${input.videoId}::uuid
      `;
      await tx`
        INSERT INTO public.media_editorial_audit_events (actor_user_id, action, details)
        VALUES (
          ${authorization.user.domainUserId}::uuid, 'media_video_rights_revoked',
          ${JSON.stringify({
            videoId: input.videoId,
            previousRightsStatus: videos[0].rights_status,
            wasPublic: videos[0].is_public,
            reason,
          })}::jsonb
        )
      `;
      return linkedArticles.map(article => String((article as any).slug));
    }));
    revalidatePath('/admin/media'); revalidatePath('/admin/news');
    revalidatePath('/news'); revalidatePath('/');
    for (const slug of affectedSlugs) revalidatePath('/news/' + slug);
    return { success: true };
  } catch (error) {
    console.error('Media video rights revocation failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to withdraw video rights.' };
  }
}
