// ✅ RUNS ON EDGE
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, email, fullName, phone } = body;
    const admin = getSupabaseAdmin();

    // Insert into public.profiles
    const { error } = await admin.from('profiles').insert({
      id: id,
      email: email,
      full_name: fullName,
      phone: phone,
      points: 50, // BONUS!
      is_vip: false,
      role: 'user'
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}