'use client';
import { useEffect, useRef, useState } from 'react';
import { Star, Lock } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import type { TurnstileInstance } from '@marsidev/react-turnstile';

const RATINGS_ENABLED = process.env.NEXT_PUBLIC_FACTSPORT_MEDIA_COMMUNITY_WRITES === 'enabled';
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_FACTSPORT_MEDIA_TURNSTILE_SITE_KEY || '';
type RatingTotal = { player_name: string; total_score: number; vote_count: number };

export default function PlayerRatingsWidget({
  matchId, lineups, status, matchDate,
}: { matchId: string; lineups: any; status: string; matchDate?: string | null }) {
  const [totals, setTotals] = useState<RatingTotal[]>([]);
  const [ownRatings, setOwnRatings] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [token, setToken] = useState('');
  const turnstile = useRef<TurnstileInstance | null>(null);
  const isFinished = ['FT', 'FINISHED', 'POST', 'ENDED', 'AET', 'PEN', 'AWARDED']
    .includes(String(status || '').toUpperCase());
  const dateMs = matchDate ? new Date(matchDate).getTime() : NaN;
  const hoursSinceKickoff = (Date.now() - dateMs) / 3_600_000;
  const canRate = RATINGS_ENABLED && isFinished && Number.isFinite(hoursSinceKickoff) &&
    hoursSinceKickoff >= 0 && hoursSinceKickoff <= 24;

  const starters: Array<{ name: string; number?: string | number }> = [
    ...(Array.isArray(lineups?.home) ? lineups.home.filter((p: any) => p?.is_starter) : []),
    ...(Array.isArray(lineups?.away) ? lineups.away.filter((p: any) => p?.is_starter) : []),
  ].filter((p: any) => typeof p?.name === 'string' && p.name.trim());

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setTotals([]);
    setOwnRatings({});
    setMessage('');
    if (!RATINGS_ENABLED || !isFinished) return;
    const query = encodeURIComponent(matchId);
    void Promise.all([
      fetch('/api/media/ratings?matchId=' + query, { cache: 'no-store' }),
      fetch('/api/media/ratings/state?matchId=' + query, {
        cache: 'no-store', credentials: 'same-origin',
      }),
    ]).then(async ([allResponse, ownResponse]) => {
      if (!allResponse.ok || !ownResponse.ok) throw new Error('Ratings temporarily unavailable.');
      const [all, own] = await Promise.all([allResponse.json(), ownResponse.json()]);
      if (!cancelled) {
        setTotals(Array.isArray(all) ? all : []);
        setOwnRatings(own?.ratings && typeof own.ratings === 'object' ? own.ratings : {});
        setReady(true);
      }
    }).catch(() => { if (!cancelled) setMessage('Ratings temporarily unavailable.'); });
    return () => { cancelled = true; };
  }, [matchId, isFinished]);

  async function rate(playerName: string, rating: number) {
    if (!canRate || !ready || sending || !token || ownRatings[playerName] !== undefined) return;
    setSending(true);
    setMessage('');
    try {
      const response = await fetch('/api/media/ratings', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, playerName, rating, turnstileToken: token }),
      });
      if (!response.ok) throw new Error(response.status === 409 ?
        'You already rated this player.' : 'Rating was not accepted.');
      const totalsResponse = await fetch('/api/media/ratings?matchId=' + encodeURIComponent(matchId), {
        cache: 'no-store',
      });
      setOwnRatings(previous => ({ ...previous, [playerName]: rating }));
      if (totalsResponse.ok) {
        const updated = await totalsResponse.json();
        if (Array.isArray(updated)) setTotals(updated);
      }
      setMessage('Rating recorded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Rating was not accepted.');
    } finally {
      turnstile.current?.reset();
      setToken('');
      setSending(false);
    }
  }

  if (!isFinished || !starters.length) return null;
  if (!RATINGS_ENABLED) return (
    <section className="fs-visual-panel mt-3 p-4" aria-label="Fan player ratings">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
        <Star size={15} /> Fan player ratings
      </div>
      <p className="mt-2 text-xs text-slate-500">Account-free fan ratings will be available after secure Media community activation.</p>
    </section>
  );

  return <section className="fs-visual-panel mt-3 p-3 sm:p-4" aria-label="Fan player ratings">
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-700">
        <Star size={16} className="text-amber-500" /> Fan player ratings
      </h3>
      {!canRate && <span className="flex items-center gap-1 text-xs text-slate-500"><Lock size={13} /> Closed</span>}
    </div>
    <p className="my-2 text-[11px] text-slate-500">No account or email required. Verified visitors may rate each starting player once.</p>
    {canRate && ready && TURNSTILE_SITE_KEY && (
      <Turnstile ref={turnstile} siteKey={TURNSTILE_SITE_KEY}
        options={{ action: 'media-rating' }}
        onSuccess={setToken} onExpire={() => setToken('')} />
    )}
    {message && <p role="status" className="my-2 text-xs text-blue-700">{message}</p>}
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {starters.map((player, index) => {
        const row = totals.find(item => item.player_name === player.name);
        const average = row && row.vote_count > 0
          ? (row.total_score / row.vote_count).toFixed(1) : '—';
        const mine = ownRatings[player.name];
        return <div key={player.name + index} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-800">{player.name}</span>
              <span className="ml-1 text-[10px] text-slate-500">{player.number ?? ''}</span>
            </div>
            <span className="rounded-lg bg-slate-900 px-2 py-1 text-sm font-black text-amber-300" aria-label={`Average rating ${average}`}>{average}</span>
          </div>
          {mine !== undefined ? <p className="text-[11px] font-bold text-amber-700">Your rating: {mine}</p> :
            canRate && ready && TURNSTILE_SITE_KEY ? (
              <div className="flex flex-wrap gap-1" aria-label={'Rate ' + player.name}>
                {[6,7,8,9,10].map(value => (
                  <button type="button" key={value} disabled={!token || sending}
                    onClick={() => void rate(player.name, value)}
                    aria-label={`Rate ${player.name} ${value} out of 10`}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-40">{value}</button>
                ))}
              </div>
            ) : null}
        </div>;
      })}
    </div>
  </section>;
}
