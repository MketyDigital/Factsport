import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { createClient } from '@/app/lib/supabase/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const id = params?.id || '';
  if (!UUID.test(id)) return NextResponse.json({ hasAnalysis: false }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  if ((env.FACTSPORT_ENVIRONMENT === 'staging' || env.FACTSPORT_ENVIRONMENT === 'production')) {
    return NextResponse.json({ error: 'V2 Prediction analysis reader is not provisioned.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const supabase = createClient();
    const [{ data: { user } }, matchResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('matches').select('pro_analysis').eq('id', id).maybeSingle(),
    ]);
    if (matchResult.error) throw matchResult.error;

    const analysis = matchResult.data?.pro_analysis;
    const hasAnalysis = !!analysis && typeof analysis === 'object' && !Array.isArray(analysis) && Object.keys(analysis).length > 0;
    if (!hasAnalysis) {
      return NextResponse.json({ hasAnalysis: false }, { headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' } });
    }
    if (!user) {
      return NextResponse.json({ hasAnalysis: true }, { headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' } });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_vip')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    if (profile?.is_vip === true) {
      return NextResponse.json({ hasAnalysis: true, analysis }, {
        headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' },
      });
    }
    return NextResponse.json({ hasAnalysis: true }, { headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' } });
  } catch {
    return NextResponse.json({ error: 'Analysis access temporarily unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
