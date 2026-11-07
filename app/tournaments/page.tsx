export const runtime = 'edge';
export const revalidate = 300;

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Trophy } from 'lucide-react';
import { listCurrentCompetitionDirectory } from '@/lib/adapters/postgres-homepage';

export const metadata: Metadata = {
  title: 'Football Tournaments & Competitions | FactSport',
  description: 'Explore football leagues and international tournaments, with fixtures, results, live standings and competition coverage.',
};

const COMPETITIONS = [
  { code: 'PL', name: 'Premier League', region: 'England', description: 'English top-flight football' },
  { code: 'PD', name: 'La Liga', region: 'Spain', description: 'Spanish top-flight football' },
  { code: 'BL1', name: 'Bundesliga', region: 'Germany', description: 'German top-flight football' },
  { code: 'SA', name: 'Serie A', region: 'Italy', description: 'Italian top-flight football' },
  { code: 'FL1', name: 'Ligue 1', region: 'France', description: 'French top-flight football' },
  { code: 'CL', name: 'Champions League', region: 'Europe', description: 'Europe’s premier club competition' },
  { code: 'WC', name: 'World Cup', region: 'International', description: 'International football’s global tournament' },
  { code: 'EC', name: 'Euros', region: 'Europe', description: 'European national-team championship' },
  { code: 'CLI', name: 'Copa America', region: 'South America', description: 'South American national-team championship' },
  { code: 'AFCON', name: 'AFCON', region: 'Africa', description: 'Africa Cup of Nations' },
];

export default async function TournamentsPage() {
  let currentByCode = new Map<string, any>();
  if (process.env.FACTSPORT_COMPETITIONS_BACKEND === 'postgres') {
    try {
      const rows = await listCurrentCompetitionDirectory();
      currentByCode = new Map(rows.map((row: any) => [row.league_code, row]));
    } catch {
      currentByCode = new Map();
    }
  }

  return (
    <main className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-20">
      <section className="bg-[#0a1428] text-white px-5 py-12 md:py-16 border-b border-blue-900/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-red-400 text-[10px] font-black uppercase tracking-[0.22em] mb-4">
            <Trophy size={14} /> Competition centre
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight">Football tournaments</h1>
          <p className="text-slate-300 text-sm md:text-base max-w-2xl mt-4 leading-relaxed">
            Follow league campaigns and international competitions. Open a competition for fixtures, results, standings, match stages and player statistics.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-6 py-10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg md:text-xl font-black">Competitions</h2>
            <p className="text-xs text-slate-500 mt-1">Competition pages show verified data when current-season feeds are available.</p>
          </div>
          <Link href="/standings" className="text-xs font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1">
            League tables <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {COMPETITIONS.map((competition) => {
            const current = currentByCode.get(competition.code);
            return (
              <Link
                key={competition.code}
                href={\`/tournaments/\${encodeURIComponent(competition.name)}\`}
                className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="w-11 h-11 rounded-xl bg-[#0a1428] text-white flex items-center justify-center shrink-0">
                    <Trophy size={19} className="text-yellow-400" />
                  </div>
                  {current && (
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-1">
                      Current data
                    </span>
                  )}
                </div>
                <div className="mt-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">{competition.region}</p>
                  <h3 className="text-lg font-black mt-1 group-hover:text-blue-700 transition-colors">{competition.name}</h3>
                  <p className="text-xs text-slate-500 mt-2">{competition.description}</p>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 mt-5 pt-4 text-[10px] font-bold text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={13} />
                    {current ? current.season : 'Fixtures & coverage'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-blue-700 group-hover:gap-2 transition-all">
                    Explore <ArrowRight size={13} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
