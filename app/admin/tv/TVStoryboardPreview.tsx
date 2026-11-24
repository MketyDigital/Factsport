'use client';

import { useEffect, useState } from 'react';
import { Activity, CircleDot, ListVideo, ShieldCheck, Users } from 'lucide-react';
import { renderMatchStorySvgScenes } from '@/lib/tv/svg-scene-renderer.mjs';

type TVEpisode = {
  id: string;
  show_format: string;
  match_id: string | null;
  revision: number;
  status: string;
  title: string;
  duration_seconds: number | null;
  updated_at: string;
};

type TVMatch = {
  id: string;
  league: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  match_date: string;
  source: string;
  version: number;
};

const scenes = [
  { id: 'opening', label: '3D opening', eyebrow: 'MATCH STORY', type: 'stadium', Icon: ListVideo },
  { id: 'lineups', label: '2D lineups', eyebrow: 'TEAM SHAPE', type: 'lineup', Icon: Users },
  { id: 'event', label: 'Illustrative 3D', eyebrow: 'KEY MOMENT', type: 'illustration', Icon: CircleDot },
  { id: 'statistics', label: '2D statistics', eyebrow: 'MATCH NUMBERS', type: 'stats', Icon: Activity },
  { id: 'closing', label: '2D closing', eyebrow: 'FULL TIME', type: 'closing', Icon: ShieldCheck },
] as const;

const previewFacts = [
  { id: 'demo-score', kind: 'score', text: 'Sample final score: 2–1', source: 'Synthetic local demo — not a real fixture', observedAt: '2026-11-23T20:00:00.000Z', verified: true, homeScore: 2, awayScore: 1 },
  { id: 'demo-lineup', kind: 'lineup', text: 'Starting XI sample · 11 names supplied', source: 'Synthetic local demo — not a real fixture', observedAt: '2026-11-23T20:00:00.000Z', verified: true },
  { id: 'demo-goal', kind: 'goal', text: 'Sample goal event · 68th minute', source: 'Synthetic local demo — not a real fixture', observedAt: '2026-11-23T19:22:00.000Z', verified: true, minute: 68 },
  { id: 'demo-stat', kind: 'stat', text: 'Sample possession · 54%–46%', source: 'Synthetic local demo — not a real fixture', observedAt: '2026-11-23T20:00:00.000Z', verified: true },
];

const previewFrames = renderMatchStorySvgScenes({
  status: 'draft',
  rights: { dataCleared: true, assetsCleared: true },
  matchId: '123e4567-e89b-42d3-a456-426614174000',
  title: 'Sample City vs Demo United',
  score: '2–1',
  sourceDigest: 'd'.repeat(64),
  facts: previewFacts,
  scenes: [
    { id: 'opening', kind: 'opening_3d', label: 'Sample City vs Demo United', factIds: [] },
    { id: 'lineups', kind: 'lineups_2d', label: 'Sample starting XI list', factIds: ['demo-lineup'] },
    { id: 'event', kind: 'event_illustration_3d', label: 'Sample goal event', factIds: ['demo-goal'], disclosure: 'Synthetic demo visualization — not a real match.' },
    { id: 'statistics', kind: 'statistics_2d', label: 'Sample verified statistic layout', factIds: ['demo-stat'] },
    { id: 'closing', kind: 'closing_2d', label: 'Sample 2–1 full-time', factIds: ['demo-score'] },
  ],
});

function StadiumScene() {
  return (
    <div className="fs-tv-stage fs-tv-stadium relative flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 p-5 md:p-8">
      <div className="fs-tv-light absolute inset-0" />
      <div className="fs-tv-stands absolute inset-x-[8%] top-[12%] h-[22%] rounded-[50%] border border-cyan-100/25 bg-[repeating-linear-gradient(90deg,rgba(147,197,253,.11)_0_2px,transparent_2px_10px)] shadow-[0_0_50px_rgba(34,211,238,.14)]" />
      <div className="fs-tv-field relative z-10 aspect-[16/7] w-full max-w-3xl overflow-hidden rounded-[45%] border border-emerald-100/60 bg-[linear-gradient(90deg,#16734f_0_12.5%,#198159_12.5%_25%,#16734f_25%_37.5%,#198159_37.5%_50%,#16734f_50%_62.5%,#198159_62.5%_75%,#16734f_75%_87.5%,#198159_87.5%)] shadow-[0_25px_65px_rgba(2,6,23,.5)]">
        <div className="absolute inset-[8%] rounded-[42%] border border-white/60" />
        <div className="absolute left-1/2 top-0 h-full border-l border-white/60" />
        <div className="absolute left-1/2 top-1/2 aspect-square w-[23%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60" />
        <div className="absolute left-[8%] top-[27%] h-[46%] w-[12%] border border-white/60" />
        <div className="absolute right-[8%] top-[27%] h-[46%] w-[12%] border border-white/60" />
        <div className="fs-tv-orbit absolute left-[39%] top-[45%] h-3 w-3 rounded-full bg-white shadow-[0_0_18px_white] md:h-4 md:w-4" />
      </div>
      <span className="absolute bottom-3 left-4 z-20 rounded-full border border-cyan-100/20 bg-slate-950/70 px-3 py-1 text-[9px] font-black uppercase tracking-[.18em] text-cyan-100">Abstract scene · no match data</span>
    </div>
  );
}

function LineupScene() {
  const points = ['18% 28%', '18% 50%', '18% 72%', '37% 20%', '37% 40%', '37% 60%', '37% 80%', '60% 30%', '60% 50%', '60% 70%', '82% 50%'];
  return (
    <div className="fs-tv-stage flex flex-col justify-center gap-4 rounded-2xl border border-white/10 bg-slate-950/80 p-5 md:p-8">
      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[.2em] text-emerald-100"><span>2D tactical board</span><span>Example shape · 4-3-3</span></div>
      <div className="relative mx-auto aspect-[16/8] w-full max-w-3xl overflow-hidden rounded-xl border border-white/50 bg-[linear-gradient(90deg,#166534,#15803d)] shadow-2xl">
        <div className="absolute inset-[5%] rounded-lg border border-white/35" />
        <div className="absolute left-1/2 top-0 h-full border-l border-white/35" />
        <div className="absolute left-1/2 top-1/2 aspect-square w-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35" />
        {points.map((point, i) => {
          const [left, top] = point.split(' ');
          return <span key={i} className="absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/80 bg-cyan-400 text-[9px] font-black text-slate-950 shadow-[0_3px_12px_rgba(2,6,23,.4)] md:h-8 md:w-8 md:text-[10px]" style={{ left, top }}>{i + 1}</span>;
        })}
      </div>
      <p className="text-center text-[10px] text-slate-300">Position markers are a layout sample; player identities and formations require verified lineup data.</p>
    </div>
  );
}

function IllustrationScene() {
  return (
    <div className="fs-tv-stage relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-amber-200/20 bg-[radial-gradient(ellipse_at_50%_110%,rgba(6,95,70,.55),transparent_55%),linear-gradient(145deg,#0f172a,#020617)] p-8 text-center">
      <div className="absolute inset-x-[12%] bottom-[16%] h-[2px] bg-gradient-to-r from-transparent via-amber-200/50 to-transparent" />
      <span className="fs-tv-ball relative grid h-16 w-16 place-items-center rounded-full border border-white/30 bg-[radial-gradient(circle_at_30%_25%,white,#cbd5e1_55%,#475569)] text-3xl shadow-[0_0_35px_rgba(255,255,255,.2)]" aria-hidden="true">⚽</span>
      <p className="relative mt-6 text-sm font-black text-white">Illustrative match scene</p>
      <p className="relative mt-2 max-w-md text-xs leading-5 text-slate-300">Any reconstructed action will be disclosed as a visualization and linked to verified source facts before an episode can be approved.</p>
      <span className="relative mt-4 rounded-full border border-amber-200/30 bg-amber-300/10 px-3 py-1 text-[9px] font-black uppercase tracking-[.17em] text-amber-100">Not footage · not a real goal</span>
    </div>
  );
}

function StatsScene() {
  return (
    <div className="fs-tv-stage flex flex-col justify-center rounded-2xl border border-white/10 bg-slate-950/85 p-6 md:p-10">
      <p className="text-center text-[10px] font-black uppercase tracking-[.22em] text-cyan-100">Verified match statistics</p>
      <div className="mx-auto mt-7 grid w-full max-w-2xl grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="space-y-4 text-right text-xs font-bold text-white"><div>Home team</div><div>Possession</div><div>Total shots</div><div>Corners</div></div>
        <div className="space-y-4 text-center text-xs font-black tabular-nums text-slate-300"><div>—</div><div>—</div><div>—</div><div>—</div></div>
        <div className="space-y-4 text-left text-xs font-bold text-white"><div>Away team</div><div>Unknown</div><div>Unknown</div><div>Unknown</div></div>
      </div>
      <p className="mt-7 text-center text-[10px] text-slate-400">Missing values stay unknown; this preview does not invent statistics.</p>
    </div>
  );
}

function SceneView({ type }: { type: (typeof scenes)[number]['type'] }) {
  if (type === 'stadium') return <StadiumScene />;
  if (type === 'lineup') return <LineupScene />;
  if (type === 'illustration') return <IllustrationScene />;
  return <StatsScene />;
}

export default function TVStoryboardPreview() {
  const [active, setActive] = useState(0);
  const [episodes, setEpisodes] = useState<TVEpisode[]>([]);
  const [episodeState, setEpisodeState] = useState<'loading' | 'ready' | 'denied' | 'unavailable'>('loading');
  const [matches, setMatches] = useState<TVMatch[]>([]);
  const [matchState, setMatchState] = useState<'loading' | 'ready' | 'denied' | 'unavailable'>('loading');
  const [creatingMatch, setCreatingMatch] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/admin/tv/episodes', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (response.status === 401 || response.status === 403) throw new Error('denied');
        if (!response.ok) throw new Error('unavailable');
        const payload = await response.json() as { episodes?: TVEpisode[] };
        if (!Array.isArray(payload.episodes)) throw new Error('unavailable');
        setEpisodes(payload.episodes);
        setEpisodeState('ready');
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        setEpisodeState(error instanceof Error && error.message === 'denied' ? 'denied' : 'unavailable');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/admin/tv/matches', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (response.status === 401 || response.status === 403) throw new Error('denied');
        if (!response.ok) throw new Error('unavailable');
        const payload = await response.json() as { matches?: TVMatch[] };
        if (!Array.isArray(payload.matches)) throw new Error('unavailable');
        setMatches(payload.matches);
        setMatchState('ready');
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        setMatchState(error instanceof Error && error.message === 'denied' ? 'denied' : 'unavailable');
      });
    return () => controller.abort();
  }, []);

  async function createDraft(match: TVMatch) {
    setCreatingMatch(match.id);
    setDraftMessage('');
    try {
      const response = await fetch('/api/admin/tv/episodes', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id }),
      });
      const payload = await response.json() as { episode?: TVEpisode; error?: string };
      if (!response.ok || !payload.episode) throw new Error(payload.error || 'Unable to create the draft.');
      setEpisodes(current => [payload.episode!, ...current.filter(item => item.id !== payload.episode!.id)]);
      setEpisodeState('ready');
      setMatches(current => current.filter(item => item.id !== match.id));
      setDraftMessage(payload.episode.status === 'blocked_rights'
        ? 'Draft created and blocked until data and asset rights are reviewed. No video was rendered or published.'
        : 'Draft created.');
    } catch (error) {
      setDraftMessage(error instanceof Error ? error.message : 'Unable to create the draft.');
    } finally {
      setCreatingMatch(null);
    }
  }

  const scene = scenes[active];
  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-800 bg-[radial-gradient(ellipse_at_85%_0%,rgba(37,99,235,.35),transparent_42%),linear-gradient(145deg,#0f172a,#020617)] p-6 text-white shadow-2xl md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-[10px] font-black uppercase tracking-[.24em] text-cyan-200">Factsport TV · Match Story</p><h1 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">Storyboard preview</h1><p className="mt-2 max-w-2xl text-xs leading-5 text-slate-300">Renderer-generated SVG sample frames for 2D data scenes and disclosed illustrative 2.5D direction. This fictional demo is disconnected from real match feeds, durable render jobs and social accounts.</p></div>
          <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.15em] text-amber-100">Preview only · not publishable</span>
        </div>
      </header>

      <section aria-labelledby="tv-episode-inventory" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 id="tv-episode-inventory" className="font-black text-slate-900">Episode inventory</h2><p className="mt-1 text-xs text-slate-600">Private V2 drafts and render status, loaded through the Entra-protected TV API.</p></div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700">{episodeState === 'loading' ? 'Loading' : episodeState === 'ready' ? 'Connected' : episodeState === 'denied' ? 'Editor access required' : 'Unavailable'}</span>
        </div>
        {episodeState === 'loading' && <p className="mt-4 text-xs text-slate-600" role="status">Loading episode inventory…</p>}
        {episodeState === 'denied' && <p className="mt-4 text-xs text-amber-900" role="status">Your signed-in account needs an active Factsport TV editor, publisher or media-admin membership to view episodes.</p>}
        {episodeState === 'unavailable' && <p className="mt-4 text-xs text-amber-900" role="status">The private episode inventory is temporarily unavailable. The synthetic storyboard below remains a disconnected preview.</p>}
        {episodeState === 'ready' && episodes.length === 0 && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">No episode records yet. The sample storyboard below uses fictional data and is not a production episode.</p>}
        {episodeState === 'ready' && episodes.length > 0 && <ul className="mt-4 divide-y divide-slate-100">{episodes.map(episode => <li key={episode.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-bold text-slate-900">{episode.title}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">{episode.show_format.replaceAll('_', ' ')} · revision {episode.revision} · {episode.duration_seconds ? Math.round(episode.duration_seconds / 60) + ' min' : 'duration pending'}</p></div><span className="rounded-full bg-cyan-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-900">{episode.status.replaceAll('_', ' ')}</span></li>)}</ul>}
      </section>

      <section aria-labelledby="tv-match-picker" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div><h2 id="tv-match-picker" className="font-black text-slate-900">Start a Match Story draft</h2><p className="mt-1 text-xs leading-5 text-slate-600">Choose a verified final V2 match. The first draft freezes score evidence and stays rights-blocked; this action never renders or publishes.</p></div>
        {draftMessage && <p className="mt-3 rounded-xl bg-cyan-50 p-3 text-xs text-cyan-950" role="status">{draftMessage}</p>}
        {matchState === 'loading' && <p className="mt-4 text-xs text-slate-600" role="status">Loading final matches…</p>}
        {matchState === 'denied' && <p className="mt-4 text-xs text-amber-900" role="status">An active Factsport TV editor, publisher or media-admin membership is required.</p>}
        {matchState === 'unavailable' && <p className="mt-4 text-xs text-amber-900" role="status">The canonical V2 match list is not available right now.</p>}
        {matchState === 'ready' && matches.length === 0 && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-xs text-slate-600">No verified final matches are available to start a draft.</p>}
        {matchState === 'ready' && matches.length > 0 && <ul className="mt-4 divide-y divide-slate-100">{matches.map(match => <li key={match.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-bold text-slate-900">{match.home_team} {match.home_score}–{match.away_score} {match.away_team}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">{match.league} · {match.status} · {match.source}</p></div><button type="button" onClick={() => void createDraft(match)} disabled={creatingMatch !== null} className="min-h-10 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-wait disabled:opacity-60">{creatingMatch === match.id ? 'Creating…' : 'Create rights-gated draft'}</button></li>)}</ul>}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(290px,.7fr)]">
        <section aria-label="Storyboard scene preview" className="min-w-0 rounded-3xl border border-slate-200 bg-slate-900 p-3 shadow-xl md:p-5">
          <div className="mb-3 flex items-center justify-between gap-3 px-1 text-[10px] font-black uppercase tracking-[.16em] text-slate-300"><span>{scene.eyebrow}</span><span>Scene {active + 1} / {scenes.length}</span></div>
          <SceneView type={scene.type} />
          <figure className="mt-4 rounded-2xl border border-cyan-200/15 bg-slate-950 p-3">
            <figcaption className="mb-2 text-[9px] font-black uppercase tracking-[.16em] text-cyan-100">Offline scene renderer output · SVG frame {active + 1}</figcaption>
            <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewFrames[active].svg)}`} alt={`${previewFrames[active].kind.replaceAll('_', ' ')} frame generated from fictional demo facts`} className="aspect-video w-full rounded-xl border border-white/10 bg-slate-950 object-contain" />
          </figure>
          <p className="mt-2 text-center text-[9px] font-bold uppercase tracking-[.15em] text-amber-100">Synthetic demo data · no real fixture, footage or player likeness</p>
          <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Storyboard scenes">
            {scenes.map(({ id, label, Icon }, index) => <button key={id} type="button" role="tab" aria-selected={index === active} onClick={() => setActive(index)} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${index === active ? 'border-cyan-300/50 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}><Icon size={14}/>{label}</button>)}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-black text-slate-900">Production readiness</h2>
            <ul className="mt-4 space-y-3 text-xs">
              <li className="flex items-start justify-between gap-3"><span className="text-slate-600">Evidence-linked scene planner</span><span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 font-bold text-emerald-700">Implemented</span></li>
              <li className="flex items-start justify-between gap-3"><span className="text-slate-600">Video renderer and durable jobs</span><span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 font-bold text-amber-800">In progress</span></li>
              <li className="flex items-start justify-between gap-3"><span className="text-slate-600">Rights-cleared match assets</span><span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-700">Required</span></li>
              <li className="flex items-start justify-between gap-3"><span className="text-slate-600">YouTube private-first adapter</span><span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 font-bold text-emerald-700">Implemented</span></li>
              <li className="flex items-start justify-between gap-3"><span className="text-slate-600">YouTube channel authorization</span><span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-700">Not connected</span></li>
              <li className="flex items-start justify-between gap-3"><span className="text-slate-600">Other social dispatch and review outbox</span><span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 font-bold text-amber-800">In progress</span></li>
            </ul>
          </section>
          <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
            <h2 className="text-sm font-black text-cyan-950">Publishing stays human-reviewed</h2>
            <p className="mt-2 text-xs leading-5 text-cyan-900">The YouTube adapter uploads privately first. No public post can be sent from this preview. Each episode still needs cleared sources/assets, an approved edit and channel authorization.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
