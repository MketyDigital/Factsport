'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

export async function updateStudioSettings(payload: {
    title: string;
    audioUrl: string;
    videoUrl: string;
    isActive: boolean;
}) {
    try {
        // 🟢 Uses the Service Role Key to securely bypass frontend RLS policies
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY! 
        );

        const { error } = await supabase
            .from('global_studio')
            .upsert({
                id: 1, 
                title: payload.title,
                audio_url: payload.audioUrl || null,
                video_url: payload.videoUrl || null,
                is_active: payload.isActive
            });

        if (error) throw new Error(error.message);

        // 🟢 Instantly clears the cache for both the admin panel and the public Live page
        revalidatePath('/admin/studio');
        revalidatePath('/live'); 
        
        return { success: true };
    } catch (err: any) {
        return { error: err.message };
    }
}