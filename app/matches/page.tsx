export const runtime = 'edge';
export const revalidate = 5;

import { env } from 'cloudflare:workers';
import Link from 'next/link';
import { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';
import MatchesClientView from '@/app/components/MatchesClientView';
import { listPostgresMatchesWindow, getPostgresTeamForm } from '@/lib/adapters/postgres-matches';

export const metadata: Metadata = {
  title: 'Football Fixtures, Live Scores & Results | FactSport',
  description: 'View today\'s football fixtures, live scores, and recent match results from the Premier League, Champions League, La Liga, WorldCup and more.',
};

export default async function AllMatchesPage({ searchParams }: { searchParams: { team?: string } }) {
  const resolvedParams = await searchParams;
  const teamFilter = resolvedParams?.team || null;
  let validMatches: any[] = [];
  let teamFormArray: string[] = [];
  const usePostgres = (env.FACTSPORT_MATCHES_BACKEND ?? process.env.FACTSPORT_MATCHES_BACKEND) === 'postgres';

  if (usePostgres) {
    const from = new Date(), to = new Date();
    if (teamFilter) {
      from.setMonth(from.getMonth() - 2);
      to.setMonth(to.getMonth() + 2);
    } else {
      from.setDate(from.getDate() - 14);
      to.setDate(to.getDate() + 14);
    }
    validMatches = await listPostgresMatchesWindow({
      from: from.toISOString(),
      to: to.toISOString(),
      teamFilter,
    });
    if (teamFilter) teamFormArray = await getPostgresTeamForm(teamFilter);
  } else {
    // Legacy Supabase remains the verification baseline until the staged
    // feature migration and data contract are approved.
    const { createClient } = await import('@supabase/supabase-js');
    const { getTeamQueryFilter } = await import('@/app/lib/teamAliases');
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    let query = supabase.from('matches').select('*').order('match_date', { ascending: true });
    if (teamFilter) {
      const teamStart = new Date(); teamStart.setMonth(teamStart.getMonth() - 2);
      const teamEnd = new Date(); teamEnd.setMonth(teamEnd.getMonth() + 2);
      query = query.gte('match_date', teamStart.toISOString())
        .lte('match_date', teamEnd.toISOString())
        .or(getTeamQueryFilter(teamFilter))
        .limit(100);
    } else {
      const globalStart = new Date(); globalStart.setDate(globalStart.getDate() - 14);
      const globalEnd = new Date(); globalEnd.setDate(globalEnd.getDate() + 14);
      query = query.gte('match_date', globalStart.toISOString())
        .lte('match_date', globalEnd.toISOString())
        .limit(1500);
    }
    const { data: matches } = await query;
    validMatches = matches || [];
    if (teamFilter) {
      const { getTeamForm } = await import('@/app/lib/teamForm');
      teamFormArray = await getTeamForm(teamFilter);
    }
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Football Fixtures, Live Scores & Results | FactSport',
    description: 'View today\'s football fixtures, live scores, and recent match results.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://factsport.com'}/matches`
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-0 font-sans selection:bg-blue-200">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="bg-[#0a1428] text-white p-3 md:p-4 flex items-center gap-3 sticky top-0 z-50 shadow-md">
        <Link href="/" className="p-1.5 rounded-full hover:bg-white/10 transition bg-white/5"><ChevronLeft size={20} /></Link>
        <div>
          <h1 className="font-black text-base md:text-lg leading-none uppercase tracking-tight">Match Center</h1>
          <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Fixtures, Results & Tables</p>
        </div>
      </div>
      <MatchesClientView initialMatches={validMatches} teamFilter={teamFilter} teamFormArray={teamFormArray} />
    </div>
  );
}
