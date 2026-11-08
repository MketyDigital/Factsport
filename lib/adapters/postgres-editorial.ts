/**
 * Public editorial read adapter for Factsport V2.
 * Queries only published, rights-filtered PostgreSQL views; no browser DB access.
 * Each operation creates and closes its own request-scoped Hyperdrive client.
 */
import 'server-only';
import { withFactsportPostgres } from '@/lib/adapters/postgres-client';

export interface PublicEditorialArticle {
  id: string; slug: string; title: string; excerpt: string | null;
  body_markdown: string; category: string; tags: string[];
  is_headline: boolean; is_breaking: boolean; author_display_name: string;
  published_at: string; created_at: string; updated_at: string;
  canonical_url: string | null; hero_media_key: string | null;
  hero_media_content_type: string | null; hero_media_alt_text: string | null;
  hero_media_attribution: string | null;
  origin: 'manual' | 'ai_assisted' | 'automated' | 'imported' | 'unknown';
  seo_title: string | null;
  seo_description: string | null;
  original_created_at: string | null;
  last_verified_at: string | null;
  team_1_name: string | null; team_2_name: string | null;
  team_1_logo_key: string | null; team_2_logo_key: string | null;
  inline_media?: Array<{ position: number; object_key: string; content_type: string; width: number | null; height: number | null; alt_text: string | null; attribution_text: string | null }>;
}
export interface PublicMediaAsset {
  object_key: string; content_type: string; byte_size: number;
  sha256: string | null; width: number | null; height: number | null;
  alt_text: string | null; attribution_text: string | null;
}

export async function listPublicEditorialArticles(input: {
  category?: string | null; limit?: number; offset?: number;
} = {}) {
  const limit = input.limit ?? 25;
  const offset = input.offset ?? 0;
  const category = input.category?.trim() || null;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Invalid editorial page size');
  if (!Number.isInteger(offset) || offset < 0 || offset > 5000) throw new Error('Invalid editorial offset');
  if (category && category.length > 80) throw new Error('Invalid editorial category');
  return withFactsportPostgres(async sql => {
    if (category && category !== 'All') {
      return sql`
        SELECT id, slug, title, excerpt, body_markdown, category, tags,
               is_headline, is_breaking, author_display_name, published_at,
               created_at, updated_at, canonical_url, hero_media_key,
               hero_media_content_type, hero_media_alt_text, hero_media_attribution,
               origin, seo_title, seo_description, original_created_at, last_verified_at,
               team_1_name, team_2_name, team_1_logo_key, team_2_logo_key,
               (SELECT count(*)::integer FROM public.public_editorial_articles WHERE category = ${category}) AS total_count
        FROM public.public_editorial_articles
        WHERE category = ${category}
        ORDER BY published_at DESC, id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }
    return sql`
      SELECT id, slug, title, excerpt, body_markdown, category, tags,
             is_headline, is_breaking, author_display_name, published_at,
             created_at, updated_at, canonical_url, hero_media_key,
             hero_media_content_type, hero_media_alt_text, hero_media_attribution,
             origin, seo_title, seo_description, original_created_at, last_verified_at,
             team_1_name, team_2_name, team_1_logo_key, team_2_logo_key,
             (SELECT count(*)::integer FROM public.public_editorial_articles) AS total_count
      FROM public.public_editorial_articles
      ORDER BY published_at DESC, id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  });
}

export async function getPublicEditorialArticle(slug: string): Promise<PublicEditorialArticle | null> {
  if (!slug || slug.length > 240 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  return withFactsportPostgres(async sql => {
    const rows = await sql`
      SELECT id, slug, title, excerpt, body_markdown, category, tags,
             is_headline, is_breaking, author_display_name, published_at,
             created_at, updated_at, canonical_url, hero_media_key,
             hero_media_content_type, hero_media_alt_text, hero_media_attribution,
             origin, seo_title, seo_description, original_created_at, last_verified_at,
             team_1_name, team_2_name, team_1_logo_key, team_2_logo_key
      FROM public.public_editorial_articles
      WHERE slug = ${slug}
      LIMIT 1
    `;
    const article = rows[0] as PublicEditorialArticle | undefined;
    if (!article) return null;
    const inlineMedia = await sql`
      SELECT position, object_key, content_type, width, height, alt_text, attribution_text
      FROM public.public_editorial_article_inline_media
      WHERE article_id = ${article.id}::uuid
      ORDER BY position ASC, object_key ASC
    `;
    return { ...article, inline_media: inlineMedia as unknown as PublicEditorialArticle['inline_media'] };
  });
}

export async function getPublicMediaAsset(key: string) {
  if (!key || key.length > 512 || !/^editorial\/[A-Za-z0-9/_-]+$/.test(key) || key.includes('..') || key.includes('//')) return null;
  return withFactsportPostgres(async sql => {
    const rows = await sql`
      SELECT object_key, content_type, byte_size, sha256, width, height, alt_text, attribution_text
      FROM public.public_media_assets
      WHERE object_key = ${key}
      LIMIT 1
    `;
    return rows[0] ?? null;
  });
}
