'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/app/lib/supabase/admin';
import { authorizeAdminAction } from '@/app/lib/admin/authorization';

export async function updateStudioSettings(payload: {
  title: string;
  audioUrl: string;
  videoUrl: string;
  isActive: boolean;
}) {
  try {
    const authorization = await authorizeAdminAction();
    if (!authorization.ok) return { error: authorization.error };
    if (!payload || typeof payload.title !== 'string' || payload.title.trim().length < 1 ||
        payload.title.length > 120 || typeof payload.isActive !== 'boolean') {
      return { error: 'Invalid studio settings.' };
    }
    const normalizeUrl = (value: string) => {
      if (!value) return null;
      if (typeof value !== 'string' || value.length > 2048) throw new Error('Invalid media URL.');
      const url = new URL(value);
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Media URLs must use HTTP or HTTPS.');
      return url.toString();
    };
    const audioUrl = normalizeUrl(payload.audioUrl || '');
    const videoUrl = normalizeUrl(payload.videoUrl || '');
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('global_studio').upsert({
      id: 1, title: payload.title.trim(), audio_url: audioUrl, video_url: videoUrl, is_active: payload.isActive,
    });
    if (error) throw error;
    revalidatePath('/admin/studio');
    revalidatePath('/live');
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to update studio settings.' };
  }
}
