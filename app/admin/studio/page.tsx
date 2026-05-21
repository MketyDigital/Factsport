export const runtime = 'edge';
export const dynamic = 'force-dynamic'; // 🟢 Modern Next.js cache killer

import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/server';
import { ShieldAlert } from 'lucide-react';
import StudioClient from './StudioClient';

// 👑 THE MASTER FAIL-SAFE LIST
const ADMIN_EMAILS = [
    'mkposcosunday@gmail.com', 
    'factsportlive@gmail.com', 
    'fact@factsport.com'
];

export default async function AdminStudioPage() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    // 1. THE BOUNCER: Kick out anyone who isn't logged in or isn't an admin
    if (!session || !session.user || !session.user.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
        redirect('/');
    }

    // 2. FETCH CURRENT STUDIO SETTINGS
    const { data: studioData, error } = await supabase
        .from('global_studio')
        .select('*')
        .eq('id', 1)
        .maybeSingle(); // 🟢 FIX 1: Prevents the page from crashing if the database is empty

    if (error) {
        console.error("Failed to fetch studio settings:", error);
    }

    return (
        <div className="min-h-screen bg-[#F0F2F5] pb-24 font-sans">
            
            {/* Admin Header */}
            <div className="bg-[#0a1428] text-white p-4 shadow-md sticky top-0 z-40 flex items-center justify-between">
                <div>
                    <h1 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        <ShieldAlert className="text-red-500" size={16} /> Admin Command
                    </h1>
                    <p className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mt-0.5">
                        Global Studio Management
                    </p>
                </div>
                <div className="bg-red-500/20 border border-red-500/50 text-red-400 text-[8px] font-black px-2 py-1 rounded shadow-inner uppercase tracking-widest">
                    Level 10 Access
                </div>
            </div>

            {/* Dashboard Content */}
            <div className="p-4 max-w-4xl mx-auto mt-4">
                <StudioClient initialData={studioData || null} />
            </div>
            
        </div>
    );
}