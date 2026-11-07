'use server';

import { revalidatePath } from 'next/cache';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { authorizeAdminAction } from '@/app/lib/admin/authorization';

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
  return parsed.toString();
}

async function getActorId(sql: any, authId: string): Promise<string | null> {
  const rows = await sql\`
    SELECT user_id FROM public.external_identities
    WHERE subject = \${authId}
    ORDER BY created_at DESC
    LIMIT 2
  \`;
  return rows.length === 1 ? rows[0].user_id : null;
}

function revalidateEditorial() {
  revalidatePath('/admin/news'); revalidatePath('/'); revalidatePath('/news'); revalidatePath('/sitemap.xml');
}

export async function saveEditorialDraft(input: EditorialInput): Promise<ActionResult<{ id: string }>> {
  const authorization = await authorizeAdminAction();
  if (!authorization.ok) return { success: false, error: authorization.error };
  try {
    const title = cleanText(input?.title, 240);
    const slug = cleanText(input?.slug, 180);
    const body = typeof input?.bodyMarkdown === 'string' ? input.bodyMarkdown : '';
    const category = cleanText(input?.category, 80) || 'Football';
    const tags = Array.isArray(input?.tags) ? [...new Set(input.tags.map(tag => cleanText(tag, 48)).filter(Boolean))].slice(0, 24) : [];
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
      const actorId = await getActorId(tx, authorization.user.id);
      if (!actorId) throw new Error('This administrator has no unique Factsport domain identity mapping. Draft ownership cannot be recorded.');
      let articleId = input.id || null;
      let currentStatus = 'draft';
      if (articleId) {
        const rows = await tx\`SELECT id, status FROM public.editorial_articles WHERE id=\${articleId}::uuid FOR UPDATE\`;
        if (!rows[0] || rows[0].status === 'archived') throw new Error('Article was not found or has been archived.');
        currentStatus = rows[0].status;
        // Published content is immutable until its replacement revision is approved.
        if (currentStatus !== 'published') {
          await tx\`
            UPDATE public.editorial_articles SET
              title=\${snapshot.title}, slug=\${snapshot.slug}, excerpt=\${snapshot.excerpt},
              body_markdown=\${snapshot.body_markdown}, category=\${snapshot.category}, tags=\${snapshot.tags},
              seo_title=\${snapshot.seo_title}, seo_description=\${snapshot.seo_description},
              canonical_url=\${snapshot.canonical_url}, author_display_name=\${snapshot.author_display_name},
              is_headline=\${snapshot.is_headline}, is_breaking=\${snapshot.is_breaking},
              status='draft', review_status='pending', reviewed_by=NULL, reviewed_at=NULL,
              published_at=NULL, updated_by=\${actorId}::uuid, updated_at=now()
            WHERE id=\${articleId}::uuid
          \`;
        }
        await tx\`
          UPDATE public.editorial_article_revisions SET workflow_status='superseded'
          WHERE article_id=\${articleId}::uuid AND workflow_status IN ('draft','in_review')
        \`;
      } else {
        const rows = await tx\`
          INSERT INTO public.editorial_articles (
            title, slug, excerpt, body_markdown, category, team_1_name, team_2_name, tags, seo_title, seo_description,
            canonical_url, author_display_name, is_headline, is_breaking, status, review_status,
            origin, created_by, updated_by
          ) VALUES (
            \${snapshot.title}, \${snapshot.slug}, \${snapshot.excerpt}, \${snapshot.body_markdown},
            \${snapshot.category}, \${snapshot.tags}, \${snapshot.seo_title}, \${snapshot.seo_description},
            \${snapshot.canonical_url}, \${snapshot.author_display_name}, \${snapshot.is_headline},
            \${snapshot.is_breaking}, 'draft', 'pending', 'manual', \${actorId}::uuid, \${actorId}::uuid
          ) RETURNING id
        \`;
        articleId = rows[0].id;
      }

      const revisions = await tx\`SELECT COALESCE(MAX(revision_number), 0)::integer AS current FROM public.editorial_article_revisions WHERE article_id=\${articleId}::uuid\`;
      await tx\`
        INSERT INTO public.editorial_article_revisions
          (article_id, revision_number, snapshot, changed_by, change_note, workflow_status)
        VALUES (
          \${articleId}::uuid, \${Number(revisions[0].current) + 1},
          \${JSON.stringify(snapshot)}::jsonb, \${actorId}::uuid, 'Editorial revision saved', 'draft'
        )
      \`;
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
  const authorization = await authorizeAdminAction();
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(articleId)) return { success: false, error: 'Invalid article identifier.' };
  try {
    await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const actorId = await getActorId(tx, authorization.user.id);
      if (!actorId) throw new Error('This administrator has no unique Factsport domain identity mapping.');
      const articles = await tx\`SELECT id, status FROM public.editorial_articles WHERE id=\${articleId}::uuid FOR UPDATE\`;
      if (!articles.length || articles[0].status === 'archived') throw new Error('Article is unavailable.');
      const revisions = await tx\`
        SELECT id FROM public.editorial_article_revisions
        WHERE article_id=\${articleId}::uuid AND workflow_status='draft'
        ORDER BY revision_number DESC LIMIT 1 FOR UPDATE
      \`;
      if (!revisions.length) throw new Error('Save a new draft revision before submitting for review.');
      await tx\`
        UPDATE public.editorial_article_revisions SET
          workflow_status='in_review', submitted_by=\${actorId}::uuid, submitted_at=now()
        WHERE id=\${revisions[0].id}::uuid
      \`;
      if (articles[0].status !== 'published') {
        await tx\`UPDATE public.editorial_articles SET status='in_review', review_status='pending', updated_at=now() WHERE id=\${articleId}::uuid\`;
      }
    }));
    revalidateEditorial(); return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to submit article.' };
  }
}

export async function approveAndPublishEditorial(articleId: string): Promise<ActionResult> {
  const authorization = await authorizeAdminAction();
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(articleId)) return { success: false, error: 'Invalid article identifier.' };
  try {
    await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const actorId = await getActorId(tx, authorization.user.id);
      if (!actorId) throw new Error('This administrator has no unique Factsport domain identity mapping. Publishing is blocked.');
      const articles = await tx\`SELECT id, status FROM public.editorial_articles WHERE id=\${articleId}::uuid FOR UPDATE\`;
      if (!articles.length || articles[0].status === 'archived') throw new Error('Article is unavailable.');
      const revisions = await tx\`
        SELECT id, changed_by, snapshot::text AS snapshot_text
        FROM public.editorial_article_revisions
        WHERE article_id=\${articleId}::uuid AND workflow_status='in_review'
        ORDER BY revision_number DESC LIMIT 1 FOR UPDATE
      \`;
      const revision = revisions[0];
      if (!revision) throw new Error('No editorial revision is awaiting approval.');
      if (!revision.changed_by) throw new Error('The revision has no verified author identity. Approval is blocked.');
      if (revision.changed_by === actorId) throw new Error('A different administrator must approve the article.');
      const snapshot = JSON.parse(revision.snapshot_text);
      await tx\`
        UPDATE public.editorial_articles SET
          title=\${snapshot.title}, slug=\${snapshot.slug}, excerpt=\${snapshot.excerpt},
          body_markdown=\${snapshot.body_markdown}, category=\${snapshot.category}, tags=\${snapshot.tags},
          seo_title=\${snapshot.seo_title}, seo_description=\${snapshot.seo_description},
          canonical_url=\${snapshot.canonical_url}, author_display_name=\${snapshot.author_display_name},
          is_headline=\${snapshot.is_headline}, is_breaking=\${snapshot.is_breaking},
          status='published', review_status='approved', reviewed_by=\${actorId}::uuid,
          reviewed_at=now(), published_at=COALESCE(published_at, now()),
          updated_by=\${actorId}::uuid, updated_at=now()
        WHERE id=\${articleId}::uuid
      \`;
      await tx\`
        UPDATE public.editorial_article_revisions SET
          workflow_status='published', reviewed_by=\${actorId}::uuid, reviewed_at=now(), published_at=now()
        WHERE id=\${revision.id}::uuid
      \`;
    }));
    revalidateEditorial(); return { success: true };
  } catch (error) {
    console.error('Editorial publish failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to publish article.' };
  }
}

export async function archiveEditorialArticle(articleId: string): Promise<ActionResult> {
  const authorization = await authorizeAdminAction();
  if (!authorization.ok) return { success: false, error: authorization.error };
  if (!/^[0-9a-f-]{36}$/i.test(articleId)) return { success: false, error: 'Invalid article identifier.' };
  try {
    const changed = await withFactsportEditorialPostgres(async sql => sql\`
      UPDATE public.editorial_articles SET status='archived', updated_at=now()
      WHERE id=\${articleId}::uuid AND status <> 'archived' RETURNING id
    \`);
    if (!changed.length) return { success: false, error: 'Article was not found or is already archived.' };
    revalidateEditorial(); return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to archive article.' };
  }
}
