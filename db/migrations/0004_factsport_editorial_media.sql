-- Factsport V2 editorial and rights-aware media foundation.
-- Apply only to the isolated factsport_v2 database after 0001 and 0002.
-- This creates empty structures only: no legacy content is copied or deleted.
BEGIN;

CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_key text NOT NULL UNIQUE,
  media_kind text NOT NULL CHECK (media_kind IN ('image', 'video', 'thumbnail', 'document')),
  content_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  sha256 char(64) CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'),
  width integer CHECK (width IS NULL OR width > 0),
  height integer CHECK (height IS NULL OR height > 0),
  alt_text text,
  rights_status text NOT NULL DEFAULT 'pending'
    CHECK (rights_status IN ('pending', 'owned', 'licensed', 'editorial_exception', 'rejected', 'expired')),
  rights_reference text,
  attribution_text text,
  source_url text,
  usage_expires_at timestamptz,
  is_public boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_object_key_scope CHECK (object_key ~ '^editorial/[A-Za-z0-9/_-]+$'),
  CONSTRAINT media_alt_text_length CHECK (alt_text IS NULL OR char_length(alt_text) <= 500),
  CONSTRAINT media_rights_expiry CHECK (
    rights_status NOT IN ('licensed', 'editorial_exception') OR rights_reference IS NOT NULL
  ),
  CONSTRAINT media_public_rights_gate CHECK (
    NOT is_public OR rights_status IN ('owned', 'licensed', 'editorial_exception')
  )
);
CREATE INDEX IF NOT EXISTS media_assets_public_rights_idx
  ON public.media_assets (rights_status, is_public, usage_expires_at);

CREATE TABLE IF NOT EXISTS public.editorial_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text,
  body_markdown text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Football',
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'published', 'archived')),
  is_headline boolean NOT NULL DEFAULT false,
  is_breaking boolean NOT NULL DEFAULT false,
  author_display_name text NOT NULL DEFAULT 'FactSport Desk',
  created_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  published_at timestamptz,
  canonical_url text,
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT editorial_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT editorial_title_length CHECK (char_length(title) BETWEEN 5 AND 240),
  CONSTRAINT editorial_excerpt_length CHECK (excerpt IS NULL OR char_length(excerpt) <= 500),
  CONSTRAINT editorial_author_length CHECK (char_length(author_display_name) BETWEEN 2 AND 120),
  CONSTRAINT editorial_publish_timestamp CHECK (
    (status = 'published' AND published_at IS NOT NULL) OR
    (status <> 'published')
  )
);
CREATE INDEX IF NOT EXISTS editorial_articles_published_idx
  ON public.editorial_articles (published_at DESC, id DESC)
  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS editorial_articles_category_published_idx
  ON public.editorial_articles (category, published_at DESC, id DESC)
  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS editorial_articles_headline_published_idx
  ON public.editorial_articles (published_at DESC)
  WHERE status = 'published' AND is_headline;

CREATE TABLE IF NOT EXISTS public.editorial_article_media (
  article_id uuid NOT NULL REFERENCES public.editorial_articles(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES public.media_assets(id) ON DELETE RESTRICT,
  placement text NOT NULL CHECK (placement IN ('hero', 'inline', 'thumbnail')),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, media_id, placement)
);
CREATE UNIQUE INDEX IF NOT EXISTS editorial_one_hero_media_idx
  ON public.editorial_article_media (article_id)
  WHERE placement = 'hero';

CREATE TABLE IF NOT EXISTS public.editorial_article_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.editorial_articles(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL CHECK (revision_number > 0),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  changed_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  change_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, revision_number)
);
CREATE INDEX IF NOT EXISTS editorial_revisions_article_idx
  ON public.editorial_article_revisions (article_id, revision_number DESC);

CREATE TABLE IF NOT EXISTS public.editorial_article_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.editorial_articles(id) ON DELETE CASCADE,
  source_title text NOT NULL,
  publisher text,
  canonical_url text NOT NULL,
  attribution_text text,
  rights_reference text,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT editorial_source_url_length CHECK (char_length(canonical_url) <= 2048)
);
CREATE INDEX IF NOT EXISTS editorial_article_sources_article_idx
  ON public.editorial_article_sources (article_id, created_at);

-- Public read view: drafts, unpublished articles, and media without approved
-- rights never enter the public read model. R2 keys are returned, not storage URLs.
CREATE OR REPLACE VIEW public.public_editorial_articles AS
SELECT
  a.id, a.slug, a.title, a.excerpt, a.body_markdown, a.category, a.tags,
  a.is_headline, a.is_breaking, a.author_display_name,
  a.published_at, a.created_at, a.updated_at, a.canonical_url,
  hero.object_key AS hero_media_key,
  hero.content_type AS hero_media_content_type,
  hero.alt_text AS hero_media_alt_text,
  hero.attribution_text AS hero_media_attribution
FROM public.editorial_articles a
LEFT JOIN LATERAL (
  SELECT m.object_key, m.content_type, m.alt_text, m.attribution_text
  FROM public.editorial_article_media am
  JOIN public.media_assets m ON m.id = am.media_id
  WHERE am.article_id = a.id
    AND am.placement = 'hero'
    AND m.is_public = true
    AND m.rights_status IN ('owned', 'licensed', 'editorial_exception')
    AND (m.usage_expires_at IS NULL OR m.usage_expires_at > now())
  LIMIT 1
) hero ON true
WHERE a.status = 'published'
  AND a.published_at <= now();

REVOKE ALL ON TABLE
  public.media_assets,
  public.editorial_articles,
  public.editorial_article_media,
  public.editorial_article_revisions,
  public.editorial_article_sources
FROM PUBLIC, factsport_v2_reader;
CREATE OR REPLACE VIEW public.public_media_assets AS
SELECT object_key, content_type, byte_size, sha256, width, height, alt_text,
       attribution_text
FROM public.media_assets
WHERE is_public = true
  AND rights_status IN ('owned', 'licensed', 'editorial_exception')
  AND (usage_expires_at IS NULL OR usage_expires_at > now());

REVOKE ALL ON public.public_editorial_articles FROM PUBLIC;
REVOKE ALL ON public.public_media_assets FROM PUBLIC;
GRANT SELECT ON public.public_editorial_articles, public.public_media_assets
  TO factsport_v2_reader;

COMMIT;
