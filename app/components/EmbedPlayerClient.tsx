'use client';

import Link from 'next/link';
import SecureMatchPlayer from '@/app/components/SecureMatchPlayer';

export default function EmbedPlayerClient({
  match,
  initialMode,
  announcement,
  appUrl,
}: {
  match: any;
  initialMode: 'video' | 'audio';
  announcement: { text: string; link: string | null; enabled: boolean };
  appUrl: string;
}) {
  return (
    <main className="relative flex h-screen w-screen flex-col overflow-hidden bg-black">
      <SecureMatchPlayer
        matchId={match.id}
        initialMode={initialMode}
        matchDate={match.match_date}
        homeTeam={match.home_team}
        awayTeam={match.away_team}
        homeLogo={match.home_logo}
        awayLogo={match.away_logo}
        announcement={announcement}
      />
      <div className="pointer-events-none absolute left-4 top-4 z-50">
        <img src="/logo.png" alt="FactSport" className="h-8 opacity-80 drop-shadow-lg" />
      </div>
      <Link
        href={`${appUrl}/match/${encodeURIComponent(match.id)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 right-3 z-50 rounded-full border border-white/20 bg-black/70 px-3 py-2 text-[10px] font-bold text-white/80 hover:bg-black"
      >
        Open match centre
      </Link>
    </main>
  );
}
