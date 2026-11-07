'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/app/lib/supabase/admin';
import { authorizeAdminAction } from '@/app/lib/admin/authorization';

type EditorialInput = {
  id?: string;
  title: string;
  slug: string;
  excerpt?: string;
  bodyMarkdown: string;
  category: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  authorDisplayName?: string;
  isHeadline?: boolean;
  isBreaking?: boolean;
};

type ActionResult<T = undefined> = { success: true; data?: T } | { success: false; error: string };

const cleanText = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

function validSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function safeHttpUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const parsed = new URL(value.trim());
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only HTTP or HTTPS URLs are allowed.');
  }
  return parsed.toString();
}

async function getActorId(adminId: string): Promise<string | null> {
  const db = getSupabaseAdmin();
  // The auth-to-domain identity bridge is explicit. Never assume that an
  // auth.users UUID is automatically a public.app_users UUID.
  const { data, error } = await db
    .from('external_identities')
    .select('user_id')
    .eq('subject', adminId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.user_id ?? null;
}

function revalidateEditorial() {
  revalidatePath('/admin/news');
  revalidatePath('/');
  revalidatePath('/news');
  revalidatePath('/sitemap.xml');
}

export async function saveEditorialDraft(input: EditorialInput): Promise<ActionResult<{ id: string }>> {
  const authorization = await authorizeAdminAction();
  if (!authorization.ok) return { success: false, error: authorization.error };

  try {
    const title = cleanText(input?.title, 240);
    const slug = cleanText(input?.slug, 180);
    const body = typeof input?.bodyMarkdown === 'string' ? input.bodyMarkdown : '';
    const category = cleanText(input?.category, 80) || 'Football';
    const tags = Array.isArray(input?.tags)
      ? [...new Set(input.tags.map(tag => cleanText(tag, 48)).filter(Boolean))].slice(0, 24)
      : [];

    if (title.length < 5) return { success: false, error: 'Headline must contain at least 5 characters.' };
    if (!validSlug(slug)) return { success: false, error: 'Use a lowercase, hyphen-separated article slug.' };
    if (body.length > 100000) return { success: false, error: 'Article body is too large.' };

    const db = getSupabaseAdmin();
    const actorId = await getActorId(authorization.user.id);
    const now = new Date().toISOString();
    const payload = {
      title,
      slug,
      excerpt: cleanText(input.excerpt, 500) || null,
      body_markdown: body,
      category,
      tags,
      seo_title: cleanText(input.seoTitle, 240) || null,
      seo_description: cleanText(input.seoDescription, 320) || null,
      canonical_url: safeHttpUrl(input.canonicalUrl),
      author_display_name: cleanText(input.authorDisplayName, 120) || 'FactSport Desk',
      is_headline: Boolean(input.isHeadline),
      is_breaking: Boolean(input.isBreaking),
      status: 'draft',
      review_status: 'pending',
      origin: 'manual',
      updated_by: actorId,
      updated_at: now,
    };

    let articleId = input.id;
    if (articleId) {
      const { data: existing, error: readError } = await db
        .from('editorial_articles').select('id,status').eq('id', articleId).maybeSingle();
      if (readError) throw readError;
      if (!existing || existing.status === 'archived') {
        return { success: false, error: 'Article was not found or has been archived.' };
      }
      const { error } = await db.from('editorial_articles').update(payload).eq('id', articleId);
      if (error) throw error;
    } else {
      const { data, error } = await db.from('editorial_articles')
        .insert({ ...payload, created_by: actorId })
        .select('id').single();
      if (error) throw error;
      articleId = data.id;
    }

    const { data: latest, error: revisionError } = await db
      .from('editorial_article_revisions')
      .select('revision_number')
      .eq('article_id', articleId!)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (revisionError) throw revisionError;

    const snapshot = {
      title, slug, excerpt: payload.excerpt, body_markdown: body, category, tags,
      seo_title: payload.seo_title, seo_description: payload.seo_description,
      canonical_url: payload.canonical_url, author_display_name: payload.author_display_name,
      is_headline: payload.is_headline, is_breaking: payload.is_breaking,
      status: 'draft', review_status: 'pending',
    };
    const { error: insertRevisionError } = await db.from('editorial_article_revisions').insert({
      article_id: articleId,
      revision_number: (latest?.revision_number ?? 0) + 1,
      snapshot,
      changed_by: actorId,
      change_note: 'Draft saved',
    });
    if (insertRevisionError) throw insertRevisionError;

    revalidateEditorial();
    return { success: true, data: { id: articleId! } };
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
    const db = getSupabaseAdmin();
    const { data, error } = await db.from('editorial_articles')
      .update({ status: 'in_review', review_status: 'pending', updated_by: await getActorId(authorization.user.id) })
      .eq('id', articleId).eq('status', 'draft').select('id').maybeSingle();
    if (error) throw error;
    if (!data) return { success: false, error: 'Only saved drafts can be submitted for review.' };
    revalidateEditorial();
    return { success: true };
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
    const db = getSupabaseAdmin();
    const actorId = await getActorId(authorization.user.id);
    if (!actorId) {
      return { success: false, error: 'This administrator is not mapped to a Factsport domain user. Publishing is blocked until the identity mapping is provisioned.' };
    }
    const { data: article, error: readError } = await db.from('editorial_articles')
      .select('id,status,review_status,created_by,published_at')
      .eq('id', articleId).maybeSingle();
    if (readError) throw readError;
    if (!article || article.status !== 'in_review' || article.review_status !== 'pending') {
      return { success: false, error: 'Only articles awaiting review can be approved.' };
    }
    if (article.created_by && article.created_by === actorId) {
      return { success: false, error: 'A different administrator must approve the article.' };
    }

    const now = new Date().toISOString();
    const { error } = await db.from('editorial_articles').update({
      status: 'published',
      review_status: 'approved',
      reviewed_by: actorId,
      reviewed_at: now,
      published_at: article.published_at || now,
      updated_by: actorId,
      updated_at: now,
    }).eq('id', articleId).eq('status', 'in_review').eq('review_status', 'pending');
    if (error) throw error;
    revalidateEditorial();
    return { success: true };
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
    const db = getSupabaseAdmin();
    const actorId = await getActorId(authorization.user.id);
    const { data, error } = await db.from('editorial_articles')
      .update({ status: 'archived', updated_by: actorId, updated_at: new Date().toISOString() })
      .eq('id', articleId).neq('status', 'archived').select('id').maybeSingle();
    if (error) throw error;
    if (!data) return { success: false, error: 'Article was not found or is already archived.' };
    revalidateEditorial();
    return { success: true };
  } catch (error) {
    console.error('Editorial archive failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to archive article.' };
  }
}
