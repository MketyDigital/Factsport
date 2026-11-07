'use server';

import { revalidatePath } from 'next/cache';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { inspectPublicMediaArticle } from '@/lib/public-media-content-policy';

type Result = { success: true } | { success: false; error: string };

export async function saveMediaHomepageAnnouncement(input: { text?: unknown; link?: unknown; enabled?: unknown }): Promise<Result> {
  const authorization = await authorizeMediaEditorialAction('publish');
  if (!authorization.ok) return { success: false, error: authorization.error };
  const announcementText = typeof input?.text === 'string' ? input.text.trim() : '';
  const rawLink = typeof input?.link === 'string' ? input.link.trim() : '';
  const enabled = input?.enabled === true;
  if (announcementText.length > 280) return { success: false, error: 'Announcement must be 280 characters or fewer.' };
  let announcementLink: string | null = null;
  if (rawLink) {
    try {
      const parsed = new URL(rawLink);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return { success: false, error: 'Use a valid public HTTP or HTTPS link.' };
      announcementLink = parsed.toString();
    } catch { return { success: false, error: 'Enter a valid announcement link.' }; }
  }
  if (enabled && !announcementText) return { success: false, error: 'Add announcement text before enabling it.' };
  const policy = inspectPublicMediaArticle({ title: announcementText, canonical_url: announcementLink });
  if (!policy.eligible) return { success: false, error: 'This announcement contains betting promotion, an affiliate link or private Prediction content.' };
  try {
    await withFactsportEditorialPostgres(async sql => sql`
      INSERT INTO public.homepage_settings
        (singleton, announcement_text, announcement_link, announcement_enabled, updated_by, updated_at)
      VALUES
        (true, ${announcementText || null}, ${announcementLink}, ${enabled}, ${authorization.user.domainUserId}::uuid, now())
      ON CONFLICT (singleton) DO UPDATE SET
        announcement_text = EXCLUDED.announcement_text,
        announcement_link = EXCLUDED.announcement_link,
        announcement_enabled = EXCLUDED.announcement_enabled,
        updated_by = EXCLUDED.updated_by,
        updated_at = now()
    `);
    revalidatePath('/');
    revalidatePath('/api/settings');
    return { success: true };
  } catch (error) {
    console.error('Media homepage settings save failed', error);
    return { success: false, error: 'Media homepage settings are not provisioned. No legacy settings fallback is allowed.' };
  }
}