export const runtime = 'edge';
export const revalidate = 0; // Never cache the admin page!

import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { ShieldAlert } from 'lucide-react';
import UsersClient from './UsersClient';

const ADMIN_EMAILS = [
    'mkposcosunday@gmail.com', 
    'factsportlive@gmail.com', 
    'fact@factsport.com'
];

export default async function AdminUsersPage() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    // 1. THE BOUNCER: Kick out anyone who isn't logged in or isn't an admin
    if (!session || !session.user || !session.user.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
        redirect('/');
    }

    // 2. GOD MODE INITIALIZATION
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. FETCH ALL PROFILES SAFELY
    const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Failed to fetch users:", error);
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
                        User Management
                    </p>
                </div>
                <div className="bg-red-500/20 border border-red-500/50 text-red-400 text-[8px] font-black px-2 py-1 rounded shadow-inner uppercase tracking-widest">
                    Level 10 Access
                </div>
            </div>

            {/* Dashboard Content */}
            <div className="p-4 max-w-6xl mx-auto">
                <UsersClient initialUsers={profiles || []} />
            </div>
            
        </div>
    );
}