'use server';

import { revalidatePath } from 'next/cache';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { inspectPublicMediaArticle, PUBLIC_MEDIA_POLICY_VERSION } from '@/lib/public-media-content-policy';
import { isFactsportStreamVideoReady } from '@/lib/media/cloudflare-stream';

type EditorialInput = {
  id?: string; title: string; slug: string; excerpt?: string; bodyMarkdown: string;
  category: string; team1Name?: string; team2Name?: string; tags?: string[]; seoTitle?: string; seoDescription?: string;
  canonicalUrl?: string; authorDisplayName?: string; isHeadline?: boolean; isBreaking?: boolean;
};
type ActionResult<T = undefined> = { success: true; data?: T } | { success: false; error: string };
const cleanText = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const validSlug = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

function safeHttpUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const parsed = new URL(value.trim());
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Only HTTP or HTTPS URLs are allowed.');
  if (parsed.username || parsed.password) throw new Error('Source URLs cannot contain embedded credentials.');
  return parsed.toString();
}

// Validate the source records behind sanctioned public article video embeds.
// Rights references are private records, never serialized into the article.
function externalVideoCanonicalUrls(body: string): string[] {
  const urls = new Set<string>();
  const iframes = body.match(/<iframe\b[^>]*>/gi) || [];
  for (const iframe of iframes) {
    const src = iframe.match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
    if (!src) continue; // The public Markdown sanitizer drops malformed embeds.
    let url: URL;
    try { url = new URL(src[2]); } catch { continue; }
    if (url.protocol !== 'https:' || url.username || url.password) continue;
    if (['www.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)) {
      const id = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})$/);
      if (id) urls.add('https://www.youtube.com/watch?v=' + id[1]);
    } else if (url.hostname === 'player.vimeo.com') {
      const id = url.pathname.match(/^\/video\/([0-9]+)$/);
      if (id) urls.add('https://vimeo.com/' + id[1]);
    }
  }
  return [...urls];
}

function assertExternalVideoSourceRights(
  body: string, sources: Array<{ canonical_url: string; attribution_text: string | null; rights_reference: string | null }>
) {
  for (const canonicalUrl of externalVideoCanonicalUrls(body)) {
    if (!sources.some(source => source.canonical_url === canonicalUrl &&
        Boolean(source.attribution_text?.trim()) && Boolean(source.rights_reference?.trim()))) {
      throw new Error('An external video requires a matching source, public attribution and private rights reference on this editorial revision.');
    }
  }
}

function revalidateEditorial() {
  revalidatePath('/admin/news'); revalidatePath('/'); revalidatePath('/news'); revalidatePath('/sitemap.xml');
}

export async function saveEditorialDraft(input: EditorialInput): Promise<ActionResult<{ id: string }>> {
  const authorization = await authorizeMediaEditorialAction('draft');
  if (!authorization.ok) return { success: false, error: authorization.error };
  try {
    const title = cleanText(input?.title, 240);
    const slug = cleanText(input?.slug, 180);
    const body = typeof input?.bodyMarkdown === 'string' ? input.bodyMarkdown : '';
    const category = cleanText(input?.category, 80) || 'Football';
    const tags = Array.isArray(input?.tags) ? Array.from(new Set(input.tags.map(tag => cleanText(tag, 48)).filter(Boolean))).slice(0, 24) : [];
    if (title.length < 5) return { success: false, error: 'Headline must contain at least 5 characters.' };
    if (!validSlug(slug)) return { success: false, error: 'Use a lowercase, hyphen-separated article slug.' };
    if (body.length > 100000) return { success: false, error: 'Article body is too large.' };

    const snapshot = {
      title, slug, excerpt: cleanText(input.excerpt, 500) || null, body_markdown: body,
      category, team_1_name: cleanText(input.team1Name, 120) || null,
      team_2_name: cleanText(input.team2Name, 120) || null, tags, seo_title: cleanText(input.seoTitle, 240) || null,
      seo_description: cleanText(input.seoDescription, 320) || null,
      canonical_url: safeHttpUrl(input.canonicalUrl),
      author_display_name: cleanText(input.authorDisplayName, 120) || 'FactSport Desk',
      is_headline: Boolean(input.isHeadline), is_breaking: Boolean(input.isBreaking),
    };

    const id = await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const actorId = authorization.user.domainUserId;

      let articleId = input.id || null;
      let currentStatus = 'draft';
      let previousRevisionId: string | null = null;
      if (articleId) {
        const rows = await tx`SELECT id, status FROM public.editorial_articles WHERE id=${articleId}::uuid FOR UPDATE`;
        if (!rows[0] || rows[0].status === 'archived') throw new Error('Article was not found or has been archived.');
        currentStatus = rows[0].status;
        const previousRevision = await tx`
          SELECT id FROM public.editorial_article_revisions
          WHERE article_id=${articleId}::uuid AND workflow_status IN ('draft','in_review','approved','rejected')
          ORDER BY revision_number DESC LIMIT 1 FOR UPDATE
        `;
        previousRevisionId = previousRevision[0]?.id || null;
        // Published content is immutable until its replacement revision is approved.
        if (currentStatus !== 'published') {
          await tx`
            UPDATE public.editorial_articles SET
              title=${snapshot.title}, slug=${snapshot.slug}, excerpt=${snapshot.excerpt},
              body_markdown=${snapshot.body_markdown}, category=${snapshot.category},
              team_1_name=${snapshot.team_1_name}, team_2_name=${snapshot.team_2_name}, tags=${snapshot.tags},
              seo_title=${snapshot.seo_title}, seo_description=${snapshot.seo_description},
              canonical_url=${snapshot.canonical_url}, author_display_name=${snapshot.author_display_name},
              is_headline=${snapshot.is_headline}, is_breaking=${snapshot.is_breaking},
              status='draft', review_status='pending', reviewed_by=NULL, reviewed_at=NULL,
              published_at=NULL, updated_by=${actorId}::uuid, updated_at=now()
            WHERE id=${articleId}::uuid
          `;
        }
        await tx`
          UPDATE public.editorial_article_revisions SET workflow_status='superseded'
          WHERE article_id=${articleId}::uuid AND workflow_status IN ('draft','in_review','approved')
        `;
      } else {
        const rows = await tx`
          INSERT INTO public.editorial_articles (
            title, slug, excerpt, body_markdown, category, team_1_name, team_2_name, tags, seo_title, seo_description,
            canonical_url, author_display_name, is_headline, is_breaking, status, review_status,
            origin, created_by, updated_by
          ) VALUES (
            ${snapshot.title}, ${snapshot.slug}, ${snapshot.excerpt}, ${snapshot.body_markdown},
            ${snapshot.category}, ${snapshot.team_1_name}, ${snapshot.team_2_name}, ${snapshot.tags}, ${snapshot.seo_title}, ${snapshot.seo_description},
            ${snapshot.canonical_url}, ${snapshot.author_display_name}, ${snapshot.is_headline},
            ${snapshot.is_breaking}, 'draft', 'pending', 'manual', ${actorId}::uuid, ${actorId}::uuid
          ) RETURNING id
        `;
        articleId = rows[0].id;
      }

      const revisions = await tx`SELECT COALESCE(MAX(revision_number), 0)::integer AS current FROM public.editorial_article_revisions WHERE article_id=${articleId}::uuid`;
      const newRevision = await tx`
        INSERT INTO public.editorial_article_revisions
          (article_id, revision_number, snapshot, changed_by, change_note, workflow_status)
        VALUES (
          ${articleId}::uuid, ${Number(revisions[0].current) + 1},
          ${JSON.stringify(snapshot)}::jsonb, ${actorId}::uuid, 'Editorial revision saved', 'draft'
        ) RETURNING id
      `;
      if (previousRevisionId) {
        await tx`
          INSERT INTO public.editorial_article_revision_media
            (revision_id, placement, position, media_id, remove_media, updated_at)
          SELECT ${newRevision[0].id}::uuid, placement, position, media_id, remove_media, now()
          FROM public.editorial_article_revision_media
          WHERE revision_id=${previousRevisionId}::uuid
          ON CONFLICT (revision_id, placement, position) DO NOTHING
        `;
      }
      else if (currentStatus === 'published') {
        await tx`
          INSERT INTO public.editorial_article_revision_media
            (revision_id, placement, position, media_id, remove_media, updated_at)
          SELECT ${newRevision[0].id}::uuid, 'hero', 0, media_id, false, now()
          FROM public.editorial_article_media
          WHERE article_id=${articleId}::uuid AND placement='hero'
          UNION ALL
          SELECT ${newRevision[0].id}::uuid, 'inline', position, media_id, false, now()
          FROM public.editorial_article_media
          WHERE article_id=${articleId}::uuid AND placement='inline'
          UNION ALL
          SELECT ${newRevision[0].id}::uuid, team_side, 0, media_id, false, now()
          FROM public.editorial_article_team_media
          WHERE article_id=${articleId}::uuid
          ON CONFLICT (revision_id, placement, position) DO NOTHING
        `;
      }
      if (previousRevisionId) {
        await tx`
          INSERT INTO public.editorial_article_revision_videos
            (revision_id, position, video_id, remove_video, updated_at)
          SELECT ${newRevision[0].id}::uuid, position, video_id, remove_video, now()
          FROM public.editorial_article_revision_videos
          WHERE revision_id=${previousRevisionId}::uuid
          ON CONFLICT (revision_id, position) DO NOTHING
        `;
      } else if (currentStatus === 'published') {
        await tx`
          INSERT INTO public.editorial_article_revision_videos
            (revision_id, position, video_id, remove_video, updated_at)
          SELECT ${newRevision[0].id}::uuid, position, video_id, false, now()
          FROM public.editorial_article_videos
          WHERE article_id=${articleId}::uuid
          ON CONFLICT (revision_id, position) DO NOTHING
        `;
      }
      if (previousRevisionId) {
        await tx`
          INSERT INTO public.editorial_article_sources
            (article_id, revision_id, source_title, publisher, canonical_url, attribution_text, rights_reference, accessed_at)
          SELECT article_id, ${newRevision[0].id}::uuid, source_title, publisher,
                 canonical_url, attribution_text, rights_reference, accessed_at
          FROM public.editorial_article_sources
          WHERE revision_id=${previousRevisionId}::uuid
        `;
      } else if (currentStatus === 'published') {
        await tx`
          INSERT INTO public.editorial_article_sources
            (article_id, revision_id, source_title, publisher, canonical_url, attribution_text, rights_reference, accessed_at)
          SELECT article_id, ${newRevision[0].id}::uuid, source_title, publisher,
                 canonical_url, attribution_text, rights_reference, accessed_at
          FROM public.editorial_article_sources
          WHERE revision_id=(
            SELECT id FROM public.editorial_article_revisions
            WHERE article_id=${articleId}::uuid AND workflow_status='published'
            ORDER BY revision_number DESC LIMIT 1
          )
        `;
      }
      await tx`
        INSERT INTO public.media_editorial_audit_events (actor_user_id, action, article_id, revision_id, details)
        VALUES (${actorId}::uuid, 'draft_saved', ${articleId}::uuid, ${newRevision[0].id}::uuid,
          ${JSON.stringify({ title: snapshot.title, slug: snapshot.slug })}::jsonb)
      `;
      return articleId!;
    }));
    revalidateEditorial();
    return { success: true, data: { id } };
  } catch (error) {
    console.error('Editorial draft save failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to save article.' };
  }
}

export async function submitEditorialForReview(articleId: string): Promise<ActionResult> {
  const authorization = await authorizeMediaEditorialAction('draft');
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(articleId)) return { success: false, error: 'Invalid article identifier.' };
  try {
    await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const actorId = authorization.user.domainUserId;

      const articles = await tx`SELECT id, status FROM public.editorial_articles WHERE id=${articleId}::uuid FOR UPDATE`;
      if (!articles.length || articles[0].status === 'archived') throw new Error('Article is unavailable.');
      const revisions = await tx`
        SELECT id, snapshot::text AS snapshot_text FROM public.editorial_article_revisions
        WHERE article_id=${articleId}::uuid AND workflow_status='draft'
        ORDER BY revision_number DESC LIMIT 1 FOR UPDATE
      `;
      if (!revisions.length) throw new Error('Save a new draft revision before submitting for review.');
      const reviewSnapshot = JSON.parse(revisions[0].snapshot_text);
      const reviewSources = await tx`
        SELECT canonical_url, attribution_text, rights_reference
        FROM public.editorial_article_sources WHERE revision_id=${revisions[0].id}::uuid
      `;
      assertExternalVideoSourceRights(String(reviewSnapshot.body_markdown || ''), reviewSources);

      await tx`
        UPDATE public.editorial_article_revisions SET
          workflow_status='in_review', submitted_by=${actorId}::uuid, submitted_at=now()
        WHERE id=${revisions[0].id}::uuid
      `;
      if (articles[0].status !== 'published') {
        await tx`UPDATE public.editorial_articles SET status='in_review', review_status='pending', updated_at=now() WHERE id=${articleId}::uuid`;
      }
      await tx`
        INSERT INTO public.media_editorial_audit_events (actor_user_id, action, article_id, revision_id)
        VALUES (${actorId}::uuid, 'submitted_for_review', ${articleId}::uuid, ${revisions[0].id}::uuid)
      `;
    }));
    revalidateEditorial(); return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to submit article.' };
  }
}

export async function approveEditorialRevision(articleId: string, comment?: string): Promise<ActionResult> {
  const authorization = await authorizeMediaEditorialAction('review');
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(articleId)) return { success: false, error: 'Invalid article identifier.' };
  const reviewComment = typeof comment === 'string' ? comment.trim().slice(0, 2000) : '';
  try {
    await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const actorId = authorization.user.domainUserId;
      const articles = await tx`SELECT id, status FROM public.editorial_articles WHERE id=${articleId}::uuid FOR UPDATE`;
      if (!articles.length || articles[0].status === 'archived') throw new Error('Article is unavailable.');
      const revisions = await tx`
        SELECT id, changed_by, submitted_by FROM public.editorial_article_revisions
        WHERE article_id=${articleId}::uuid AND workflow_status='in_review'
        ORDER BY revision_number DESC LIMIT 1 FOR UPDATE
      `;
      const revision = revisions[0];
      if (!revision) throw new Error('No editorial revision is awaiting review.');
      if (!revision.changed_by || revision.changed_by === actorId || revision.submitted_by === actorId) {
        throw new Error('A different authorized editor must review the revision.');
      }
      await tx`
        UPDATE public.editorial_article_revisions SET
          workflow_status='approved', reviewed_by=${actorId}::uuid, reviewed_at=now(), review_comment=${reviewComment || null}
        WHERE id=${revision.id}::uuid
      `;
      await tx`
        INSERT INTO public.media_editorial_audit_events (actor_user_id, action, article_id, revision_id, details)
        VALUES (${actorId}::uuid, 'review_approved', ${articleId}::uuid, ${revision.id}::uuid,
          ${JSON.stringify({ comment: reviewComment || null })}::jsonb)
      `;
    }));
    revalidateEditorial(); return { success: true };
  } catch (error) {
    console.error('Editorial review approval failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to approve revision.' };
  }
}

export async function rejectEditorialRevision(articleId: string, comment: string): Promise<ActionResult> {
  const authorization = await authorizeMediaEditorialAction('review');
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(articleId)) return { success: false, error: 'Invalid article identifier.' };
  const reviewComment = typeof comment === 'string' ? comment.trim().slice(0, 2000) : '';
  if (reviewComment.length < 5) return { success: false, error: 'Add a review note explaining the requested changes (at least 5 characters).' };
  try {
    await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const actorId = authorization.user.domainUserId;
      const articles = await tx`SELECT id, status FROM public.editorial_articles WHERE id=${articleId}::uuid FOR UPDATE`;
      if (!articles.length || articles[0].status === 'archived') throw new Error('Article is unavailable.');
      const revisions = await tx`
        SELECT id, changed_by, submitted_by FROM public.editorial_article_revisions
        WHERE article_id=${articleId}::uuid AND workflow_status='in_review'
        ORDER BY revision_number DESC LIMIT 1 FOR UPDATE
      `;
      const revision = revisions[0];
      if (!revision) throw new Error('No editorial revision is awaiting review.');
      if (!revision.changed_by || revision.changed_by === actorId || revision.submitted_by === actorId) {
        throw new Error('A different authorized editor must review the revision.');
      }
      await tx`
        UPDATE public.editorial_article_revisions SET
          workflow_status='rejected', reviewed_by=${actorId}::uuid,
          reviewed_at=now(), review_comment=${reviewComment}
        WHERE id=${revision.id}::uuid
      `;
      if (articles[0].status !== 'published') {
        await tx`
          UPDATE public.editorial_articles SET status='draft', review_status='rejected',
            reviewed_by=${actorId}::uuid, reviewed_at=now(), updated_at=now()
          WHERE id=${articleId}::uuid
        `;
      }
      await tx`
        INSERT INTO public.media_editorial_audit_events (actor_user_id, action, article_id, revision_id, details)
        VALUES (${actorId}::uuid, 'review_rejected', ${articleId}::uuid, ${revision.id}::uuid,
          ${JSON.stringify({ comment: reviewComment })}::jsonb)
      `;
    }));
    revalidateEditorial(); return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to reject revision.' };
  }
}

export async function publishApprovedEditorial(articleId: string, publicContentConfirmed: boolean): Promise<ActionResult> {
  const authorization = await authorizeMediaEditorialAction('publish');
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(articleId)) return { success: false, error: 'Invalid article identifier.' };
  if (publicContentConfirmed !== true) return { success: false, error: 'Confirm the public Media content policy before publishing.' };
  try {
    await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const actorId = authorization.user.domainUserId;
      const articles = await tx`SELECT id, status FROM public.editorial_articles WHERE id=${articleId}::uuid FOR UPDATE`;
      if (!articles.length || articles[0].status === 'archived') throw new Error('Article is unavailable.');
      const revisions = await tx`
        SELECT id, changed_by, submitted_by, reviewed_by, snapshot::text AS snapshot_text
        FROM public.editorial_article_revisions
        WHERE article_id=${articleId}::uuid AND workflow_status='approved'
        ORDER BY revision_number DESC LIMIT 1 FOR UPDATE
      `;
      const revision = revisions[0];
      if (!revision) throw new Error('No approved editorial revision is ready to publish.');
      if (!revision.changed_by || !revision.reviewed_by ||
          revision.changed_by === actorId || revision.submitted_by === actorId ||
          revision.reviewed_by === actorId) {
        throw new Error('Publishing requires a publisher distinct from the author, submitter and reviewer.');
      }
      const snapshot = JSON.parse(revision.snapshot_text);
      const publishSources = await tx`
        SELECT canonical_url, attribution_text, rights_reference
        FROM public.editorial_article_sources WHERE revision_id=${revision.id}::uuid
      `;
      assertExternalVideoSourceRights(String(snapshot.body_markdown || ''), publishSources);

      const contentPolicy = inspectPublicMediaArticle(snapshot);
      if (!contentPolicy.eligible) throw new Error('This revision contains betting promotion, affiliate links or private Prediction content and cannot be published on public Media.');
      const revisionMedia = await tx`
        SELECT placement, position, media_id, remove_media
        FROM public.editorial_article_revision_media
        WHERE revision_id=${revision.id}::uuid FOR UPDATE
      `;
      const revisionVideos = await tx`
        SELECT position, video_id, remove_video
        FROM public.editorial_article_revision_videos
        WHERE revision_id=${revision.id}::uuid FOR UPDATE
      `;
      if (revisionVideos.some(video => video.video_id && !video.remove_video) && !isFactsportStreamVideoReady()) {
        throw new Error('Cloudflare Stream playback is not ready in this environment. Video publication is blocked.');
      }
      const existingVideoIds = await tx`
        SELECT video_id FROM public.editorial_article_videos
        WHERE article_id=${articleId}::uuid
      `;
      for (const videoAttachment of revisionVideos) {
        const videoId = videoAttachment.video_id as string | null;
        if (videoId && !videoAttachment.remove_video) {
          const approvedVideo = await tx`
            SELECT id, title, description FROM public.media_video_assets
            WHERE id=${videoId}::uuid AND upload_status='ready'
              AND rights_status IN ('owned','licensed','editorial_exception')
              AND rights_reviewed_by IS NOT NULL AND rights_reviewed_at IS NOT NULL
              AND (usage_expires_at IS NULL OR usage_expires_at > now())
              AND playback_host IS NOT NULL
            FOR SHARE
          `;
          if (!approvedVideo.length) throw new Error('A revision video is not processed or no longer has valid rights approval. Publishing is blocked.');
          const videoPolicy = inspectPublicMediaArticle({
            ...snapshot,
            body_markdown: [snapshot.body_markdown, approvedVideo[0].title, approvedVideo[0].description || ''].join('\n'),
          });
          if (!videoPolicy.eligible) throw new Error('Video title or description contains content that is not eligible for public Media publication.');
        }
      }
      for (const attachment of revisionMedia) {
        const mediaId = attachment.media_id as string | null;
        if (mediaId && !attachment.remove_media) {
          const approvedAsset = await tx`
            SELECT id, alt_text FROM public.media_assets
            WHERE id=${mediaId}::uuid AND media_kind='image'
              AND rights_status IN ('owned', 'licensed', 'editorial_exception')
              AND rights_reviewed_by IS NOT NULL AND rights_reviewed_at IS NOT NULL
              AND (usage_expires_at IS NULL OR usage_expires_at > now())
            FOR SHARE
          `;
          if (!approvedAsset.length) throw new Error('A revision image no longer has valid rights approval. Publishing is blocked.');
          if ((attachment.placement === 'hero' || attachment.placement === 'inline') &&
              !String(approvedAsset[0].alt_text || '').trim()) {
            throw new Error('Hero and inline images require descriptive alt text before publication.');
          }
          if (attachment.placement === 'team_1' && !String(snapshot.team_1_name || '').trim()) {
            throw new Error('A team 1 logo requires the corresponding team name.');
          }
          if (attachment.placement === 'team_2' && !String(snapshot.team_2_name || '').trim()) {
            throw new Error('A team 2 logo requires the corresponding team name.');
          }
        }
      }
      await tx`
        UPDATE public.editorial_articles SET
          title=${snapshot.title}, slug=${snapshot.slug}, excerpt=${snapshot.excerpt},
          body_markdown=${snapshot.body_markdown}, category=${snapshot.category},
          team_1_name=${snapshot.team_1_name}, team_2_name=${snapshot.team_2_name}, tags=${snapshot.tags},
          seo_title=${snapshot.seo_title}, seo_description=${snapshot.seo_description},
          canonical_url=${snapshot.canonical_url}, author_display_name=${snapshot.author_display_name},
          is_headline=${snapshot.is_headline}, is_breaking=${snapshot.is_breaking},
          status='published', review_status='approved', reviewed_by=${revision.reviewed_by}::uuid,
          reviewed_at=now(), published_at=COALESCE(published_at, now()),
          updated_by=${actorId}::uuid, updated_at=now()
        WHERE id=${articleId}::uuid
      `;
      for (const attachment of revisionMedia) {
        const mediaId = attachment.media_id as string | null;
        if (attachment.placement === 'hero') {
          await tx`DELETE FROM public.editorial_article_media WHERE article_id=${articleId}::uuid AND placement='hero'`;
          if (mediaId && !attachment.remove_media) {
            await tx`INSERT INTO public.editorial_article_media (article_id, media_id, placement, position)
              VALUES (${articleId}::uuid, ${mediaId}::uuid, 'hero', 0)`;
          }
        } else if (attachment.placement === 'team_1' || attachment.placement === 'team_2') {
          await tx`DELETE FROM public.editorial_article_team_media
            WHERE article_id=${articleId}::uuid AND team_side=${attachment.placement}`;
          if (mediaId && !attachment.remove_media) {
            await tx`INSERT INTO public.editorial_article_team_media (article_id, team_side, media_id)
              VALUES (${articleId}::uuid, ${attachment.placement}, ${mediaId}::uuid)`;
          }
        } else if (attachment.placement === 'inline') {
          await tx`DELETE FROM public.editorial_article_media
            WHERE article_id=${articleId}::uuid AND placement='inline' AND position=${attachment.position}`;
          if (mediaId && !attachment.remove_media) {
            await tx`INSERT INTO public.editorial_article_media (article_id, media_id, placement, position)
              VALUES (${articleId}::uuid, ${mediaId}::uuid, 'inline', ${attachment.position})`;
          }
        }
        if (mediaId && !attachment.remove_media) {
          await tx`UPDATE public.media_assets SET is_public=true, updated_at=now() WHERE id=${mediaId}::uuid`;
        }
      }
      for (const videoAttachment of revisionVideos) {
        const videoId = videoAttachment.video_id as string | null;
        await tx`
          DELETE FROM public.editorial_article_videos
          WHERE article_id=${articleId}::uuid AND position=${videoAttachment.position}
        `;
        if (videoId && !videoAttachment.remove_video) {
          await tx`
            INSERT INTO public.editorial_article_videos (article_id, position, video_id)
            VALUES (${articleId}::uuid, ${videoAttachment.position}, ${videoId}::uuid)
          `;
          await tx`
            UPDATE public.media_video_assets
            SET is_public=true, updated_at=now()
            WHERE id=${videoId}::uuid
          `;
        }
      }
      if (existingVideoIds.length) {
        const oldIds = existingVideoIds.map((row: any) => row.video_id as string);
        await tx`
          UPDATE public.media_video_assets v
          SET is_public=false, updated_at=now()
          WHERE v.id = ANY(${oldIds}::uuid[])
            AND NOT EXISTS (
              SELECT 1 FROM public.editorial_article_videos live
              WHERE live.video_id=v.id
            )
        `;
      }
      await tx`
        UPDATE public.editorial_article_revisions SET
          workflow_status='published', published_at=now(),
          public_media_policy_confirmed_by=${actorId}::uuid,
          public_media_policy_confirmed_at=now(),
          public_media_policy_version=${PUBLIC_MEDIA_POLICY_VERSION}
        WHERE id=${revision.id}::uuid
      `;
      await tx`
        INSERT INTO public.media_editorial_audit_events (actor_user_id, action, article_id, revision_id, details)
        VALUES (${actorId}::uuid, 'published', ${articleId}::uuid, ${revision.id}::uuid,
          ${JSON.stringify({ publicMediaPolicyVersion: PUBLIC_MEDIA_POLICY_VERSION, publicContentConfirmed: true })}::jsonb)
      `;
    }));
    revalidateEditorial(); return { success: true };
  } catch (error) {
    console.error('Editorial publish failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to publish article.' };
  }
}


export async function restoreEditorialRevision(articleId: string, revisionId: string): Promise<ActionResult<{ id: string }>> {
  const authorization = await authorizeMediaEditorialAction('draft');
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(articleId) || !/^[0-9a-f-]{36}$/i.test(revisionId)) {
    return { success: false, error: 'Invalid article or revision identifier.' };
  }
  try {
    const newRevisionId = await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const actorId = authorization.user.domainUserId;
      const articles = await tx`
        SELECT id, status FROM public.editorial_articles
        WHERE id=${articleId}::uuid FOR UPDATE
      `;
      if (!articles.length || articles[0].status === 'archived') throw new Error('Article is unavailable.');
      const source = await tx`
        SELECT id, revision_number, snapshot::text AS snapshot_text
        FROM public.editorial_article_revisions
        WHERE id=${revisionId}::uuid AND article_id=${articleId}::uuid
        LIMIT 1 FOR SHARE
      `;
      if (!source.length) throw new Error('The selected revision does not belong to this article.');
      const snapshot = JSON.parse(source[0].snapshot_text);
      const next = await tx`
        SELECT COALESCE(MAX(revision_number), 0)::integer AS current
        FROM public.editorial_article_revisions
        WHERE article_id=${articleId}::uuid
      `;
      if (articles[0].status !== 'published') {
        await tx`
          UPDATE public.editorial_articles SET
            title=${snapshot.title}, slug=${snapshot.slug}, excerpt=${snapshot.excerpt || null},
            body_markdown=${snapshot.body_markdown || ''}, category=${snapshot.category || 'Football'},
            team_1_name=${snapshot.team_1_name || null}, team_2_name=${snapshot.team_2_name || null},
            tags=${Array.isArray(snapshot.tags) ? snapshot.tags : []},
            seo_title=${snapshot.seo_title || null}, seo_description=${snapshot.seo_description || null},
            canonical_url=${snapshot.canonical_url || null}, author_display_name=${snapshot.author_display_name || 'FactSport Desk'},
            is_headline=${Boolean(snapshot.is_headline)}, is_breaking=${Boolean(snapshot.is_breaking)},
            status='draft', review_status='pending', reviewed_by=NULL, reviewed_at=NULL,
            published_at=NULL, updated_by=${actorId}::uuid, updated_at=now()
          WHERE id=${articleId}::uuid
        `;
      }
      const created = await tx`
        INSERT INTO public.editorial_article_revisions
          (article_id, revision_number, snapshot, changed_by, change_note, workflow_status)
        VALUES (
          ${articleId}::uuid, ${Number(next[0].current) + 1},
          ${JSON.stringify(snapshot)}::jsonb, ${actorId}::uuid,
          ${'Restored from revision #' + source[0].revision_number}, 'draft'
        ) RETURNING id
      `;
      await tx`
        INSERT INTO public.editorial_article_revision_media
          (revision_id, placement, position, media_id, remove_media, updated_at)
        SELECT ${created[0].id}::uuid, placement, position, media_id, remove_media, now()
        FROM public.editorial_article_revision_media
        WHERE revision_id=${revisionId}::uuid
        ON CONFLICT (revision_id, placement, position) DO NOTHING
      `;
      await tx`
        INSERT INTO public.editorial_article_revision_videos
          (revision_id, position, video_id, remove_video, updated_at)
        SELECT ${created[0].id}::uuid, position, video_id, remove_video, now()
        FROM public.editorial_article_revision_videos
        WHERE revision_id=${revisionId}::uuid
        ON CONFLICT (revision_id, position) DO NOTHING
      `;
      await tx`
        INSERT INTO public.editorial_article_sources
          (article_id, revision_id, source_title, publisher, canonical_url, attribution_text, rights_reference, accessed_at)
        SELECT article_id, ${created[0].id}::uuid, source_title, publisher,
               canonical_url, attribution_text, rights_reference, accessed_at
        FROM public.editorial_article_sources
        WHERE revision_id=${revisionId}::uuid
      `;
      await tx`
        UPDATE public.editorial_article_revisions
        SET workflow_status='superseded'
        WHERE article_id=${articleId}::uuid
          AND id <> ${created[0].id}::uuid
          AND workflow_status IN ('draft','in_review','approved')
      `;
      await tx`
        INSERT INTO public.media_editorial_audit_events (actor_user_id, action, article_id, revision_id, details)
        VALUES (
          ${actorId}::uuid, 'draft_saved', ${articleId}::uuid, ${created[0].id}::uuid,
          ${JSON.stringify({ restoredFromRevisionId: revisionId, restoredFromRevisionNumber: source[0].revision_number })}::jsonb
        )
      `;
      return created[0].id as string;
    }));
    revalidateEditorial();
    return { success: true, data: { id: newRevisionId } };
  } catch (error) {
    console.error('Editorial revision restore failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to restore revision.' };
  }
}

export async function archiveEditorialArticle(articleId: string): Promise<ActionResult> {
  const authorization = await authorizeMediaEditorialAction('archive');
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(articleId)) return { success: false, error: 'Invalid article identifier.' };
  try {
    await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const actorId = authorization.user.domainUserId;
      const changed = await tx`
        UPDATE public.editorial_articles SET status='archived', updated_by=${actorId}::uuid, updated_at=now()
        WHERE id=${articleId}::uuid AND status <> 'archived' RETURNING id
      `;
      if (!changed.length) throw new Error('Article was not found or is already archived.');
      await tx`
        INSERT INTO public.media_editorial_audit_events (actor_user_id, action, article_id)
        VALUES (${actorId}::uuid, 'archived', ${articleId}::uuid)
      `;
    }));
    revalidateEditorial(); return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to archive article.' };
  }
}


export async function addEditorialSource(input: {
  articleId: string; sourceTitle: string; publisher?: string;
  canonicalUrl: string; attributionText?: string; rightsReference?: string;
}): Promise<ActionResult<{ id: string }>> {
  const authorization = await authorizeMediaEditorialAction('draft');
  if (!authorization.ok) return { success: false, error: authorization.error };
  try {
    if (!/^[0-9a-f-]{36}$/i.test(input?.articleId || '')) {
      return { success: false, error: 'Invalid article reference.' };
    }
    const sourceTitle = cleanText(input.sourceTitle, 240);
    const publisher = cleanText(input.publisher, 160) || null;
    const canonicalUrl = safeHttpUrl(cleanText(input.canonicalUrl, 2048));
    const attributionText = cleanText(input.attributionText, 500) || null;
    const rightsReference = cleanText(input.rightsReference, 2048) || null;
    if (sourceTitle.length < 3 || !canonicalUrl) {
      return { success: false, error: 'Provide a source title and a valid HTTP or HTTPS source URL.' };
    }
    const result = await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const articles = await tx`
        SELECT id, slug, status FROM public.editorial_articles
        WHERE id=${input.articleId}::uuid AND status <> 'archived'
        FOR UPDATE
      `;
      if (!articles.length) throw new Error('Article was not found or has been archived.');
      const draftRevision = await tx`
        SELECT id FROM public.editorial_article_revisions
        WHERE article_id=${input.articleId}::uuid AND workflow_status='draft'
        ORDER BY revision_number DESC LIMIT 1 FOR UPDATE
      `;
      if (!draftRevision.length) throw new Error('Save a draft revision before adding source provenance.');
      const inserted = await tx`
        INSERT INTO public.editorial_article_sources
          (article_id, revision_id, source_title, publisher, canonical_url, attribution_text, rights_reference)
        VALUES (
          ${input.articleId}::uuid, ${draftRevision[0].id}::uuid, ${sourceTitle}, ${publisher},
          ${canonicalUrl}, ${attributionText}, ${rightsReference}
        )
        RETURNING id
      `;
      await tx`
        INSERT INTO public.media_editorial_audit_events
          (actor_user_id, action, article_id, revision_id, details)
        VALUES (
          ${authorization.user.domainUserId}::uuid, 'source_added', ${input.articleId}::uuid, ${draftRevision[0].id}::uuid,
          ${JSON.stringify({ sourceTitle, publisher, canonicalUrl })}::jsonb
        )
      `;
      return { id: inserted[0].id as string, slug: articles[0].slug as string, status: articles[0].status as string };
    }));
    revalidatePath('/admin/news');
    if (result.status === 'published') revalidatePath('/news/' + result.slug);
    return { success: true, data: { id: result.id } };
  } catch (error) {
    console.error('Editorial source creation failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to add the editorial source.' };
  }
}
