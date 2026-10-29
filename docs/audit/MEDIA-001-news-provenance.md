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
