/**
 * Public editorial read adapter for Factsport V2.
 * Queries only published, rights-filtered PostgreSQL views; no browser DB access.
 */
import 'server-only';
import postgres from 'postgres';
import { env } from 'cloudflare:workers';

export interface PublicEditorialArticle {
  id: string; slug: string; title: string; excerpt: string | null;
  body_markdown: string; category: string; tags: string[];
  is_headline: boolean; is_breaking: boolean; author_display_name: string;
  published_at: string; created_at: string; updated_at: string;
  canonical_url: string | null; hero_media_key: string | null;
  hero_media_content_type: string | null; hero_media_alt_text: string | null;
  hero_media_attribution: string | null;
}
export interface PublicMediaAsset {
  object_key: string; content_type: string; byte_size: number;
  sha256: string | null; width: number | null; height: number | null;
  alt_text: string | null; attribution_text: string | null;
}

let client: ReturnType<typeof postgres> | undefined;
function db() {
  if (!client) {
    const connectionString = env?.FACTSPORT_HYPERDRIVE?.connectionString;
    if (!connectionString) throw new Error('Factsport PostgreSQL connection is not configured');
    client = postgres(connectionString, {
      max: 1, fetch_types: false, prepare: true, idle_timeout: 5, connect_timeout: 10,
    });
  }
  return client;
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
  const sql = db();
  if (category && category !== 'All') {
    return sql`
      SELECT id, slug, title, excerpt, body_markdown, category, tags,
             is_headline, is_breaking, author_display_name, published_at,
             created_at, updated_at, canonical_url, hero_media_key,
             hero_media_content_type, hero_media_alt_text, hero_media_attribution,
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
           (SELECT count(*)::integer FROM public.public_editorial_articles) AS total_count
    FROM public.public_editorial_articles
    ORDER BY published_at DESC, id DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function getPublicEditorialArticle(slug: string) {
  if (!slug || slug.length > 240 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const sql = db();
  const rows = await sql`
    SELECT id, slug, title, excerpt, body_markdown, category, tags,
           is_headline, is_breaking, author_display_name, published_at,
           created_at, updated_at, canonical_url, hero_media_key,
           hero_media_content_type, hero_media_alt_text, hero_media_attribution
    FROM public.public_editorial_articles
    WHERE slug = ${slug}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getPublicMediaAsset(key: string) {
  if (!key || key.length > 512 || !/^editorial\/[A-Za-z0-9/_-]+$/.test(key) || key.includes('..') || key.includes('//')) return null;
  const sql = db();
  const rows = await sql`
    SELECT object_key, content_type, byte_size, sha256, width, height, alt_text, attribution_text
    FROM public.public_media_assets
    WHERE object_key = ${key}
    LIMIT 1
  `;
  return rows[0] ?? null;
}
