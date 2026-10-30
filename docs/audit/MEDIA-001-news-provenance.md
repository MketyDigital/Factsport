# MEDIA-001 — News preservation and provenance audit
Date: 2026-10-30
Status: VERIFIED SOURCE (selected files); legacy DB article provenance not verified

## User decision
Some published articles are manually authored, others generated via AI workflow. Do not blindly reset/delete all `news`. Prioritize original/manual editorial assets for preservation; classify every article by origin with evidence. Keep old source DB untouched. Production remains paused.

## Verified source
- `app/admin/news/page.tsx` lines 87-101: paginated news listing and title search. Lines 121-139: edit existing article. Lines 141-175: manual create/update/delete directly on Supabase `news`. Stored payload: title, body, image_url, team_1_logo, team_2_logo, is_breaking, is_headline, slug and category. There is no created_by, generation_method or author attribution in this payload.
- `scripts/daily-preview.js` lines 159-161 and 224-228: AI/Gemini-generated scheduled article uses unique slug `daily-briefing-YYYY-MM-DD`, inserts into `news`, no explicit provenance metadata.
- `scripts/daily-summary.js` lines 79-81 and 148-152: AI/Gemini-generated article uses `matchday-roundup-YYYY-MM-DD`, inserts into same `news` table, no explicit provenance metadata.
- `app/news/page.tsx`: lists `news` using `created_at` ordering, category filter and pagination; `app/news/[slug]/page.tsx`: renders article and SEO metadata from `news` row. Current article structured data uses generic 'FactSport Desk' author.
- `app/admin/news/page.tsx` lines 103-118: Auto Bot button tries `/api/cron/news?key=${process.env.NEXT_PUBLIC_CRON_KEY}`; this route was absent from the repository's audited recursive path list. Also a public env-prefixed cron credential reference in client code — investigate leakage; do NOT deploy or reuse credential.
- `app/api/cron/morning-post/route.ts` and `app/api/evening-roundup/route.ts`: schedule/social publishing workflows, not necessarily article creation. Inspect distinctions.
- `app/api/social/route.ts` accepts webhook requests and uploads generated image assets to Supabase `socials` bucket; migration must preserve functional equivalent (likely R2).

## Risks and classification
1. Current audited write paths do not provide a reliable article provenance field. Slug prefixes are useful clues for known jobs, not proof an article was human-authored; a human may edit AI posts, other scripts may publish, and unknown automation paths may exist.
2. AI article generation is tied to match results and AI provider. Recreate workflow, don't carry over automatically generated historical fixture summaries unless explicitly approved.
3. Human-authored and edited articles are durable editorial assets: preserve title, body, slug, date, images, metadata, authorship and ownership as appropriate. Retaining legacy slugs avoids SEO loss and broken links.
4. Establish provenance attributes in new CMS schema: `origin` (manual, ai_assisted, automated, imported, unknown), `author_id`, `reviewed_by`, `review_status`, `source_refs`, `original_created_at`, `published_at`, `last_verified_at`. Never infer attribution purely from body wording.
5. Protect non-original third-party articles/images with licensing review. AI generation must be editorially reviewed for factual correctness, sources and originality.
6. Source public repository contains route using NEXT_PUBLIC_CRON_KEY in client code; investigate secret exposure; rotate affected tokens if exposed.
7. Current admin writes directly to Supabase browser client; new design should use authenticated server-side CMS authorization and audit logging.
8. Existing slugs may conflict with newly generated articles; ensure unique constraints and explicit ownership and redirects.

## Next audit queries (read-only, aggregate only)
First verify available columns from information_schema. Then classify known auto-slug patterns and all other entries without presuming authorship. Do not upload article bodies or user data publicly.

## Migration acceptance criteria
- Editorial inventory reconciled: total news rows vs manual/AI/unknown buckets (actual data).
- Human authored articles preserved with stable URL slugs, image availability and SEO metadata.
- AI workflows, prompts, schedule, publication gates, indexing, social distribution and source-fact-checking reconstructed.
- Post-relaunch, generated news records explicitly marked as such; editors may override with audited review.
- No accidental removal of manually authored posts during clean database reset.

## SQL 05 + 06 — Database-confirmed news inventory (2026-10-30)
User-provided read-only aggregates (exact `COUNT(*)`, not estimated): 366 total articles.
- 167 rows with `daily-briefing-YYYY-MM-DD` slugs (2026-02-22 through 2026-10-29).
- 120 rows with `matchday-roundup-YYYY-MM-DD` slugs (2026-03-10 through 2026-10-26).
- 79 rows with neither known slug pattern (2026-01-29 through 2026-07-19). **UNKNOWN origin, not automatically manual.**
- 287/366 rows (78.4%) match known automation slug patterns; 79/366 (21.6%) require further provenance review.
- DB schema confirmed: `id uuid DEFAULT gen_random_uuid()`, `title text NOT NULL`, `slug text NOT NULL`, `image_url text`, `content text`, `is_breaking boolean DEFAULT false`, `created_at timestamptz DEFAULT now()`, `body text`, `author text DEFAULT 'FactSport Admin'`, `is_headline boolean DEFAULT false`, `team_1_logo text`, `team_2_logo text`, `original_source_id text`, `category text DEFAULT 'Football'`.
- There is NO origin/provenance discriminator in these 14 columns. `author` default does not indicate human authorship, and `original_source_id` may help investigate but is not an authorship guarantee.
- The renderer uses `body || content` fallback, but admin edit form populates `body` only. Preserve both columns and avoid losing legacy `content` on export or editor migration.
- Existing article structured metadata hardcodes `FactSport Desk` as author even though the schema contains `author`. New CMS should preserve actual attribution where verified and avoid inventing it.
- Export plan: prepare all 79 unknown-origin rows for editorial review, with metadata first. Preserve original manual articles and modified AI-assisted originals based on verification; keep temporary protected export of all 366 until signoff (outside public Git).
- No public GitHub commit of raw article bodies, data dumps, private metadata, or credentials.

### Next read-only classification SQL
```sql
SELECT
  id, slug, left(title, 140) AS title,
  author, category, created_at,
  original_source_id,
  (NULLIF(BTRIM(body), '') IS NOT NULL) AS has_body,
  (NULLIF(BTRIM(content), '') IS NOT NULL) AS has_content,
  (NULLIF(BTRIM(image_url), '') IS NOT NULL) AS has_image,
  is_headline, is_breaking
FROM public.news
WHERE slug !~ '^daily-briefing-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  AND slug !~ '^matchday-roundup-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
ORDER BY created_at, slug;
```
Review `original_source_id` for unexpected private values before sharing. This query reads metadata only, not bodies; titles/slugs are still editorial content and should be kept in the chat or a private audit location, not published automatically to public GitHub.

## SQL 07 — reviewed 79 metadata rows (2026-10-30)
User supplied metadata listing for 79 articles not covered by the two original AI slug patterns; analyzed all 79 rows.
- 37 additional `roundup` / `round-up` slug patterns, for example `bundesliga-roundup-2026-02-22` and `factsport-matchday-round-up-serie-a-2026-02-21`. Classification: **suspected automated / must verify source writer**, not proven AI-generated.
- Remaining 42 do not have those roundup slug patterns. Classification: **editorial preservation review**, not proven manually written. Includes previews, reporting, transfer pieces and longer-form articles.
- All 79: `has_body=true`, `has_content=false`, `original_source_id=NULL`, `author=FactSport Admin`. 16 have `has_image=true`; 30 flagged headline, 33 flagged breaking. These flags are editorial presentation data, not reliable provenance.
- Revised totals: 167 known AI daily-briefing-pattern, 120 known AI daily-roundup-pattern, 37 suspected other roundup-pattern, 42 other editorial = 366. So 324 have known-or-suspected automated briefing/roundup patterns, but only 287 belong to the two verified creator-script naming patterns.
- Do not migrate metadata without checking article bodies, image URL licensing/availability, author/source verification, and editor approval. News content and user-provided metadata are NOT committed to public GitHub.

### Next investigation
1. Search remaining repository scripts, API routes and historical workflow code for e.g. `-roundup-`, `news.insert`, `from('news')`, and any AI writers responsible for the 37 alternate slugs.
2. Verify actual author provenance for 42 editorial candidates with editorial review. Do not infer originality from title, image presence, or default author.
3. Independently preserve backup of all 366 articles until migration decisions signed off; keep source DB intact.
4. Request aggregate counts by slug group + image host if needed, but no automatic publication to GitHub.
