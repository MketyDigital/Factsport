import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';
import { getExternalData } from '@/app/lib/matchService';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: dbData } = await supabase.from('matches').select('*').eq('id', params.id).single();
  
  if (!dbData) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const freshData = await getExternalData(dbData);
  return NextResponse.json(freshData);
}