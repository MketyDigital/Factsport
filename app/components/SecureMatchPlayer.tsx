'use client';

import { useEffect, useState } from 'react';
import { Clock, Loader2, Radio } from 'lucide-react';
import FactSportPlayer from '@/app/components/FactSportPlayer';

type Playback = {
  status: 'locked' | 'ready' | 'unavailable';
  unlockAt?: string;
  mediaUrl?: string;
  mode?: 'video' | 'audio';
  isFinished?: boolean;
  audioUrl?: string | null;
};

export default function SecureMatchPlayer(props: {
  matchId: string;
  initialMode: 'video' | 'audio';
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  announcement?: { text: string; link: string | null; enabled: boolean };
}) {
  const [state, setState] = useState<'loading' | 'locked' | 'ready' | 'unavailable'>('loading');
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [unlockAt, setUnlockAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const checkPlayback = async () => {
      try {
        const response = await fetch(`/api/match/${encodeURIComponent(props.matchId)}/playback`, { cache: 'no-store' });
        const data = await response.json() as Playback;
        if (!active) return;

        if (response.ok && data.status === 'ready' && typeof data.mediaUrl === 'string' && (data.mode === 'video' || data.mode === 'audio')) {
          setPlayback(data);
          setState('ready');
          return;
        }
        if (response.ok && data.status === 'locked') {
          setUnlockAt(data.unlockAt || null);
          setPlayback({ ...data, mode: data.mode || props.initialMode });
          setState('locked');
          const unlockTime = data.unlockAt ? new Date(data.unlockAt).getTime() : Date.now() + 30000;
          const delay = Number.isFinite(unlockTime) ? Math.max(5000, Math.min(30000, unlockTime - Date.now())) : 30000;
          timer = setTimeout(checkPlayback, delay);
          return;
        }
        if (response.status === 503 || response.status >= 500) {
          setState(current => current === 'locked' ? 'locked' : 'loading');
          timer = setTimeout(checkPlayback, 30000);
          return;
        }
        setPlayback({ status: 'unavailable' });
        setState('unavailable');
      } catch {
        if (!active) return;
        setState(current => current === 'locked' ? 'locked' : 'loading');
        timer = setTimeout(checkPlayback, 30000);
      }
    };

    void checkPlayback();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [props.matchId, props.initialMode]);

  if (state === 'ready' && playback?.mediaUrl) {
    return (
      <FactSportPlayer
        mediaUrl={playback.mediaUrl}
        matchId={props.matchId}
        mode={playback.mode || props.initialMode}
        isLocked={false}
        matchDate={props.matchDate}
        isFinished={playback.isFinished === true}
        homeTeam={props.homeTeam}
        awayTeam={props.awayTeam}
        homeLogo={props.homeLogo || undefined}
        awayLogo={props.awayLogo || undefined}
        audioUrl={playback.audioUrl}
        announcement={props.announcement}
      />
    );
  }

  return (
    <div className={`w-full ${props.initialMode === 'audio' ? 'h-[120px]' : 'aspect-video'} bg-[#0a1428] relative flex flex-col items-center justify-center overflow-hidden border-b border-slate-800 shadow-inner`}>
      <div className="absolute inset-0 bg-[url('/tournaments/default-bg.jpg')] bg-cover opacity-20 blur-md grayscale" />
      <div className="relative z-10 flex flex-col items-center gap-2 px-4 text-center">
        {state === 'loading' ? <Loader2 className="w-8 h-8 text-slate-300 animate-spin" /> : state === 'locked' ? <Clock className="w-8 h-8 text-slate-300 animate-pulse" /> : <Radio className="w-8 h-8 text-red-500" />}
        <span className="text-white font-black uppercase tracking-widest text-[10px]">
          {state === 'loading' ? 'Checking broadcast availability' : state === 'locked' ? 'Live coverage is locked' : 'Broadcast currently unavailable'}
        </span>
        {state === 'locked' && (
          <span className="text-blue-300 font-bold text-[9px] uppercase tracking-wider">
            {unlockAt ? `Coverage unlocks at ${new Date(unlockAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Coverage opens 15 minutes before kickoff'}
          </span>
        )}
      </div>
    </div>
  );
}
