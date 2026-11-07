'use server';

import { revalidatePath } from 'next/cache';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { authorizeAdminAction } from '@/app/lib/admin/authorization';

type EditorialInput = {
  id?: string; title: string; slug: string; excerpt?: string; bodyMarkdown: string;
  category: string; tags?: string[]; seoTitle?: string; seoDescription?: string;
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
  // Domain identity is resolved through the explicit bridge; UUIDs are not assumed interchangeable.
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

    const payload = {
      title, slug, excerpt: cleanText(input.excerpt, 500) || null, body,
      category, tags, seoTitle: cleanText(input.seoTitle, 240) || null,
      seoDescription: cleanText(input.seoDescription, 320) || null,
      canonicalUrl: safeHttpUrl(input.canonicalUrl),
      authorDisplayName: cleanText(input.authorDisplayName, 120) || 'FactSport Desk',
      isHeadline: Boolean(input.isHeadline), isBreaking: Boolean(input.isBreaking),
    };

    const id = await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const actorId = await getActorId(tx, authorization.user.id);
      let articleId = input.id || null;
      if (articleId) {
        const rows = await tx\`SELECT id, status FROM public.editorial_articles WHERE id = \${articleId}::uuid FOR UPDATE\`;
        if (!rows[0] || rows[0].status === 'archived') throw new Error('Article was not found or has been archived.');
        await tx\`
          UPDATE public.editorial_articles SET
            title=\${payload.title}, slug=\${payload.slug}, excerpt=\${payload.excerpt},
            body_markdown=\${payload.body}, category=\${payload.category}, tags=\${payload.tags},
            seo_title=\${payload.seoTitle}, seo_description=\${payload.seoDescription},
            canonical_url=\${payload.canonicalUrl}, author_display_name=\${payload.authorDisplayName},
            is_headline=\${payload.isHeadline}, is_breaking=\${payload.isBreaking},
            status='draft', review_status='pending', reviewed_by=NULL, reviewed_at=NULL,
            published_at=NULL, updated_by=\${actorId}::uuid, updated_at=now()
          WHERE id=\${articleId}::uuid
        \`;
      } else {
        const rows = await tx\`
          INSERT INTO public.editorial_articles (
            title, slug, excerpt, body_markdown, category, tags, seo_title, seo_description,
            canonical_url, author_display_name, is_headline, is_breaking, status, review_status,
            origin, created_by, updated_by
          ) VALUES (
            \${payload.title}, \${payload.slug}, \${payload.excerpt}, \${payload.body}, \${payload.category},
            \${payload.tags}, \${payload.seoTitle}, \${payload.seoDescription}, \${payload.canonicalUrl},
            \${payload.authorDisplayName}, \${payload.isHeadline}, \${payload.isBreaking},
            'draft', 'pending', 'manual', \${actorId}::uuid, \${actorId}::uuid
          ) RETURNING id
        \`;
        articleId = rows[0].id;
      }

      const revisions = await tx\`SELECT COALESCE(MAX(revision_number), 0)::integer AS current FROM public.editorial_article_revisions WHERE article_id=\${articleId}::uuid\`;
      const snapshot = {
        title: payload.title, slug: payload.slug, excerpt: payload.excerpt, body_markdown: payload.body,
        category: payload.category, tags: payload.tags, seo_title: payload.seoTitle,
        seo_description: payload.seoDescription, canonical_url: payload.canonicalUrl,
        author_display_name: payload.authorDisplayName, is_headline: payload.isHeadline,
        is_breaking: payload.isBreaking, status: 'draft', review_status: 'pending',
      };
      await tx\`
        INSERT INTO public.editorial_article_revisions
          (article_id, revision_number, snapshot, changed_by, change_note)
        VALUES (\${articleId}::uuid, \${Number(revisions[0].current) + 1},
          \${JSON.stringify(snapshot)}::jsonb, \${actorId}::uuid, 'Draft saved')
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
    const changed = await withFactsportEditorialPostgres(async sql => sql\`
      UPDATE public.editorial_articles SET status='in_review', review_status='pending', updated_at=now()
      WHERE id=\${articleId}::uuid AND status='draft' RETURNING id
    \`);
    if (!changed.length) return { success: false, error: 'Only saved drafts can be submitted for review.' };
    revalidateEditorial(); return { success: true };
  } catch (error) {
    console.error('Editorial review submission failed', error);
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
      const rows = await tx\`SELECT id, status, review_status, created_by FROM public.editorial_articles WHERE id=\${articleId}::uuid FOR UPDATE\`;
      const article = rows[0];
      if (!article || article.status !== 'in_review' || article.review_status !== 'pending') throw new Error('Only articles awaiting review can be approved.');
      if (article.created_by && article.created_by === actorId) throw new Error('A different administrator must approve the article.');
      await tx\`
        UPDATE public.editorial_articles SET status='published', review_status='approved',
          reviewed_by=\${actorId}::uuid, reviewed_at=now(), published_at=COALESCE(published_at, now()),
          updated_by=\${actorId}::uuid, updated_at=now()
        WHERE id=\${articleId}::uuid
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
    console.error('Editorial archive failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to archive article.' };
  }
}
