'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Home, Newspaper, PlayCircle, Radio, Table2, Trophy } from 'lucide-react';

const mediaNavigation = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/matches', label: 'Matches', icon: CalendarDays },
  { href: '/live', label: 'Live', icon: Radio },
  { href: '/standings', label: 'Standings', icon: Table2 },
  { href: '/tournaments', label: 'Leagues', icon: Trophy },
  { href: '/news', label: 'News', icon: Newspaper },
  { href: '/highlights', label: 'Highlights', icon: PlayCircle },
] as const;

export default function SiteHeader() {
  const pathname = usePathname() || '/';

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a1428] text-white shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href="/" aria-label="FactSport home" className="flex shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
          <img src="/logo.png" alt="FactSport" className="h-9 w-auto object-contain md:h-11" />
        </Link>
        <p className="hidden text-xs font-semibold tracking-wide text-slate-300 lg:block">Independent sports coverage</p>
        <Link
          href="/live"
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-red-300/30 bg-red-600/15 px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-red-100 transition hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
        >
          <span className="h-2 w-2 rounded-full bg-red-400" aria-hidden="true" />
          Live centre
        </Link>
      </div>

      <nav aria-label="Media navigation" className="border-t border-white/5">
        <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] md:justify-center md:px-6 [&::-webkit-scrollbar]:hidden">
          {mediaNavigation.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href} className="shrink-0">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 md:px-4 ${
                    active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
