/**
 * Shared 2D sports-data comparison for Media match details.
 * No animation library or 3D canvas; labels remain available to assistive
 * technologies and missing provider numbers are never fabricated.
 */
type Value = string | number | null | undefined;

export function parseVisualStat(value: Value): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)\s*%?$/.test(text)) return null;
  const number = Number(text.replace('%', '').trim());
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export default function VisualStatCompare({
  label, home, away, homeTeam = 'Home', awayTeam = 'Away',
}: {
  label: string;
  home: Value;
  away: Value;
  homeTeam?: string;
  awayTeam?: string;
}) {
  const h = parseVisualStat(home);
  const a = parseVisualStat(away);
  const hasBoth = h !== null && a !== null;
  const total = hasBoth ? h + a : 0;
  const homePercentage = hasBoth && total > 0 ? Math.max(0, Math.min(100, h / total * 100)) : 0;
  const homeText = h === null ? '—' : String(home).trim();
  const awayText = a === null ? '—' : String(away).trim();

  return (
    <div className="fs-visual-panel p-3 sm:p-4" aria-label={label}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
        <div className="min-w-0 text-left">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 truncate">{homeTeam}</span>
          <span className="text-xl font-black tabular-nums text-blue-700">{homeText}</span>
        </div>
        <h4 className="max-w-[150px] text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600">{label}</h4>
        <div className="min-w-0 text-right">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 truncate">{awayTeam}</span>
          <span className="text-xl font-black tabular-nums text-rose-600">{awayText}</span>
        </div>
      </div>
      <div
        className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-slate-200 ring-1 ring-slate-200"
        role="img"
        aria-label={hasBoth ? `${homeTeam}: ${homeText}; ${awayTeam}: ${awayText}` : `${label} data not fully available`}
      >
        {hasBoth && total > 0 ? (
          <>
            <div className="h-full bg-gradient-to-r from-blue-700 to-sky-400" style={{ width: `${homePercentage}%` }} />
            <div className="h-full flex-1 bg-gradient-to-r from-rose-400 to-rose-600" />
          </>
        ) : (
          <div className="h-full w-full bg-slate-200" />
        )}
      </div>
    </div>
  );
}
