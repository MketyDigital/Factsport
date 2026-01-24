export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// SECURE ADMIN LIST
const ADMIN_EMAILS = ['mkposcosunday@gmail.com', 'factsportlive@gmail.com'];

export async function POST(req: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // --- SECURITY CHECK (Hybrid) ---
    const { searchParams } = new URL(req.url);
    const authHeader = req.headers.get('Authorization');
    
    let isAuthorized = false;

    // Method 1: CRON KEY (For Automation via cron-job.org)
    if (searchParams.get('key') === process.env.CRON_KEY) {
        isAuthorized = true;
    }
    // Method 2: ADMIN SESSION (For Manual Button)
    else if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user && ADMIN_EMAILS.includes(user.email || '')) {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Key or Admin' }, { status: 401 });
    }
    // --------------------------------

    // THE RESET LOGIC
    const { error } = await supabase
      .from('profiles')
      .update({ 
        monthly_points: 0,
        monthly_correct_scores: 0 
      })
      .gt('id', '00000000-0000-0000-0000-000000000000'); // Targets all users

    if (error) throw error;

    return NextResponse.json({ success: true, message: "New Month Started! All monthly scores reset." });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}