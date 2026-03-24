export const runtime = 'edge';
export const revalidate = 5;

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

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
   
  // 🟢 CORRECTED: MASSIVE 8-MONTH FETCH WINDOW (-4 Months to +4 Months)
  // Grabs the bulk of the current season, cached on the server, and paginated by the client!
  const startDate = new Date(); startDate.setMonth(startDate.getMonth() - 4); 
  const endDate = new Date(); endDate.setMonth(endDate.getMonth() + 4); 

  // Bumped limit to 5000 to ensure we don't accidentally cut off the season data
  let query = supabase.from('matches').select('*').order('match_date', { ascending: true }).limit(5000);
  
  if (teamFilter) {
      // If searching for a team, grab 2 months back and 2 months forward
      const teamStart = new Date(); teamStart.setDate(teamStart.getDate() - 60);
      const teamEnd = new Date(); teamEnd.setDate(teamEnd.getDate() + 60);
      
      const queryFilter = getTeamQueryFilter(teamFilter);
      query = query.gte('match_date', teamStart.toISOString()).lte('match_date', teamEnd.toISOString()).or(queryFilter);
  } else {
      query = query.gte('match_date', startDate.toISOString()).lte('match_date', endDate.toISOString());
  }

  const { data: matches } = await query;
  const validMatches = matches || [];

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
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-20 font-sans selection:bg-blue-200">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        
        <div className="bg-[#0a1428] text-white p-3 md:p-4 flex items-center gap-3 sticky top-0 z-50 shadow-md">
            <Link href="/" className="p-1.5 rounded-full hover:bg-white/10 transition bg-white/5"><ChevronLeft size={20} /></Link>
            <div>
                <h1 className="font-black text-base md:text-lg leading-none uppercase tracking-tight">Match Center</h1>
                <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Fixtures & Results</p>
            </div>
        </div>

        {/* 🟢 HANDS OFF ALL RENDERING LOGIC TO THE CLIENT ENGINE */}
        <MatchesClientView 
            initialMatches={validMatches} 
            teamFilter={teamFilter} 
            teamFormArray={teamFormArray} 
        />
    </div>
  );
}