export const runtime = 'edge';
export const revalidate = 5; // 🟢 ISR Cache: Protects database from traffic spikes

import { createClient } from '@supabase/supabase-js'; 
import Link from 'next/link';
import { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';
import MatchesClientView from '@/app/components/MatchesClientView'; 
import { getTeamForm } from '@/app/lib/teamForm';
import { getTeamQueryFilter } from '@/app/lib/teamAliases';

export const metadata: Metadata = {
  title: 'Football Fixtures, Live Scores & Results | FactSport',
  description: 'View today\'s football fixtures, live scores, and recent match results from the Premier League, Champions League, La Liga, WorldCup and more.',
};

export default async function AllMatchesPage({ searchParams }: { searchParams: { team?: string } }) {
  const resolvedParams = await searchParams;
  const teamFilter = resolvedParams?.team || null; 

  // 🟢 Server-side DB connection
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
   
  let query = supabase.from('matches').select('*').order('match_date', { ascending: true });
  
  if (teamFilter) {
      // 🟢 TEAM VIEW: Fetch a wide 4-month window, but ONLY for this specific team (Results in ~20-40 matches)
      const teamStart = new Date(); teamStart.setMonth(teamStart.getMonth() - 2);
      const teamEnd = new Date(); teamEnd.setMonth(teamEnd.getMonth() + 2);
      
      const queryFilter = getTeamQueryFilter(teamFilter);
      query = query
        .gte('match_date', teamStart.toISOString())
        .lte('match_date', teamEnd.toISOString())
        .or(queryFilter)
        .limit(100); // Hard cap for safety
  } else {
      // 🟢 GLOBAL VIEW: Strict 28-Day Window (-14 days to +14 days)
      // This perfectly fuels the Calendar Strip while saving massive amounts of Mobile RAM
      const globalStart = new Date(); globalStart.setDate(globalStart.getDate() - 14); 
      const globalEnd = new Date(); globalEnd.setDate(globalEnd.getDate() + 14); 
      
      query = query
        .gte('match_date', globalStart.toISOString())
        .lte('match_date', globalEnd.toISOString())
        .limit(1500); // Cap it just in case it's a crazy busy week
  }

  const { data: matches } = await query;
  const validMatches = matches || [];

  // Fetch the 5-game form array if a team is searched
  let teamFormArray: string[] = [];
  if (teamFilter) {
      teamFormArray = await getTeamForm(teamFilter);
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
        
        {/* 🟢 TOP NAV HEADER */}
        <div className="bg-[#0a1428] text-white p-3 md:p-4 flex items-center gap-3 sticky top-0 z-50 shadow-md">
            <Link href="/" className="p-1.5 rounded-full hover:bg-white/10 transition bg-white/5"><ChevronLeft size={20} /></Link>
            <div>
                <h1 className="font-black text-base md:text-lg leading-none uppercase tracking-tight">Match Center</h1>
                <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Fixtures, Results & Tables</p>
            </div>
        </div>

        {/* 🟢 THE ENGINE */}
        <MatchesClientView 
            initialMatches={validMatches} 
            teamFilter={teamFilter} 
            teamFormArray={teamFormArray} 
        />
    </div>
  );
}