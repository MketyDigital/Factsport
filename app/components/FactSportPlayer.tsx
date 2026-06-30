'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Radio, Loader2, Clock, Tv } from 'lucide-react';
import FactSportMediaRoom from './FactSportMediaRoom';
import { useGlobalMedia } from '@/app/providers/GlobalMediaProvider';

export default function FactSportPlayer({ 
  mediaUrl, 
  matchId, 
  mode = 'video', 
  isLocked = false, 
  isFinished = false,
  matchDate,
  homeTeam,
  awayTeam,
  homeLogo,
  awayLogo,
  isEmbed = false,
  announcement
}: { 
  mediaUrl: string, 
  matchId: string, 
  mode?: 'video' | 'audio', 
  isLocked?: boolean, 
  isFinished?: boolean,
  matchDate?: string,
  homeTeam?: string,
  awayTeam?: string,
  homeLogo?: string,
  awayLogo?: string,
  isEmbed?: boolean,
  announcement?: { text: string; link?: string | null; enabled: boolean }
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [uiBlocker, setUiBlocker] = useState(false);
  
  const [isTimeLocked, setIsTimeLocked] = useState(isLocked);
  const [coverageTimeText, setCoverageTimeText] = useState('Coverage starts 5 mins to Kick-off'); // EDIT HERE: Default coverage text
  
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerWrapperRef = useRef<HTMLDivElement>(null);
  const { activeMatchId, tuneInVideo, setIsPageActive } = useGlobalMedia();

  const isYouTube = mediaUrl && (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be') || mediaUrl.includes('embed/'));
  const isRawMedia = mediaUrl && !!mediaUrl.match(/\.(mp4|webm|ogg|mp3|m3u8|wav)$/i);
  const isRawAudio = mediaUrl && !!mediaUrl.match(/\.(mp3|wav)$/i);

  useEffect(() => {
      setIsTimeLocked(isLocked);
      if (matchDate && isLocked) {
          const timeStr = new Date(matchDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          // EDIT HERE: Coverage time text when locked and matchDate is present
          setCoverageTimeText(`Coverage begins at ${timeStr}`);
      }
  }, [isLocked, matchDate]);

  useEffect(() => {
      if (!isTimeLocked || isFinished || !matchDate) return;

      const kickoffTime = new Date(matchDate).getTime();
      const unlockTime = kickoffTime - (5 * 60 * 1000);
      const timeUntilUnlock = unlockTime - Date.now();

      if (timeUntilUnlock > 0) {
          const timeout = setTimeout(() => {
              setIsTimeLocked(false);
          }, timeUntilUnlock);
          return () => clearTimeout(timeout);
      } else {
          setIsTimeLocked(false);
      }
  }, [isTimeLocked, matchDate, isFinished]);

  useEffect(() => {
      if (activeMatchId === matchId && setIsPageActive) setIsPageActive(true);
      return () => { if (setIsPageActive) setIsPageActive(false); };
  }, [activeMatchId, matchId, setIsPageActive]);

  // 🟢 GLOBAL REGISTRATION SHIELD
  useEffect(() => {
      if (!tuneInVideo) return;
      if (isTimeLocked || !mediaUrl || mediaUrl === 'streamio' || activeMatchId === matchId) return;

      const shouldAutoRegister = mode === 'audio' || isFinished || isRawMedia;

      if (shouldAutoRegister) {
          let finalUrl = mediaUrl;
          if (isYouTube) {
              let videoId = '';
              if (mediaUrl.includes('v=')) videoId = mediaUrl.split('v=')[1]?.split('&')[0];
              else if (mediaUrl.includes('.be/')) videoId = mediaUrl.split('.be/')[1];
              else if (mediaUrl.includes('embed/')) videoId = mediaUrl.split('embed/')[1];
              finalUrl = `https://www.youtube.com/embed/${videoId}`;
          }
          
          if (mode === 'audio') {
              finalUrl += '#is-audio-mode';
          }

          tuneInVideo(matchId, finalUrl);
      }
  }, [isTimeLocked, mediaUrl, matchId, activeMatchId, mode, isFinished, isYouTube, isRawMedia, tuneInVideo]);

  const startPlayback = () => {
      setHasStarted(true);
      setIsPlaying(true);
      if (isYouTube && iframeRef.current) {
          iframeRef.current.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'playVideo' }), '*');
          setUiBlocker(true);
          // HOW TO EDIT UI BLOCKER TIMEOUT:
          // Change the '4000' below (in milliseconds) to adjust how long the top/bottom bars hide the YouTube UI
          setTimeout(() => setUiBlocker(false), 4000);
      } else if (mediaRef.current) {
          mediaRef.current.play();
      }
  };

  const togglePlay = () => {
    if (!hasStarted) {
        startPlayback();
        return;
    }
    if (isYouTube && iframeRef.current) {
        iframeRef.current.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: isPlaying ? 'pauseVideo' : 'playVideo' }), '*');
        if (!isPlaying) {
            setUiBlocker(true);
            // HOW TO EDIT UI BLOCKER TIMEOUT:
            // Change the '4000' below (in milliseconds) to adjust how long the top/bottom bars hide the YouTube UI
            setTimeout(() => setUiBlocker(false), 4000);
        }
        setIsPlaying(!isPlaying);
    } else if (mediaRef.current) {
      if (isPlaying) mediaRef.current.pause();
      else mediaRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (isYouTube && iframeRef.current) {
        iframeRef.current.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: isMuted ? 'unMute' : 'mute' }), '*');
        setIsMuted(!isMuted);
    } else if (mediaRef.current) {
      mediaRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      const current = mediaRef.current.currentTime;
      const total = mediaRef.current.duration || 1; 
      setProgress((current / total) * 100);
    }
  };

  const handleFullscreen = () => {
    const container = playerWrapperRef.current;
    if (!container) return;

    if (container.classList.contains('fixed') && container.classList.contains('z-[9999]')) {
        container.classList.remove('fixed', 'inset-0', 'z-[9999]', 'w-screen', 'h-screen');
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
        return;
    }

    const requestFS = container.requestFullscreen || (container as any).webkitRequestFullscreen || (container as any).msRequestFullscreen || (container as any).mozRequestFullScreen;
    
    if (requestFS) {
      requestFS.call(container).catch(() => {
        container.classList.add('fixed', 'inset-0', 'z-[9999]', 'w-screen', 'h-screen');
      });
    } else {
      container.classList.add('fixed', 'inset-0', 'z-[9999]', 'w-screen', 'h-screen');
    }
  };

  const DefaultPreview = () => (
      <div ref={playerWrapperRef} className="w-full aspect-video bg-[#0a1428] relative flex flex-col items-center justify-center overflow-hidden border-b border-slate-800 shadow-inner group">
          <div className="absolute inset-0 bg-[url('/tournaments/default-bg.jpg')] bg-cover bg-center opacity-20 blur-md"></div>
          <div className="relative z-10 flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
              <div className="flex items-center gap-6 md:gap-10">
                  <div className="flex flex-col items-center gap-2">
                      {homeLogo ? <img src={homeLogo} className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-xl" alt={homeTeam} /> : <div className="w-16 h-16 bg-slate-800 rounded-full border border-white/10 shadow-lg"></div>}
                      <span className="text-white font-black text-[10px] md:text-xs uppercase tracking-widest text-center max-w-[100px] truncate drop-shadow-md">{homeTeam || 'Home'}</span>
                  </div>
                  <div className="text-2xl md:text-3xl font-black text-slate-500 italic drop-shadow-md">VS</div>
                  <div className="flex flex-col items-center gap-2">
                      {awayLogo ? <img src={awayLogo} className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-xl" alt={awayTeam} /> : <div className="w-16 h-16 bg-slate-800 rounded-full border border-white/10 shadow-lg"></div>}
                      <span className="text-white font-black text-[10px] md:text-xs uppercase tracking-widest text-center max-w-[100px] truncate drop-shadow-md">{awayTeam || 'Away'}</span>
                  </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                  <span className="text-blue-400 font-bold uppercase tracking-widest text-[9px] md:text-[10px] bg-blue-900/60 px-4 py-1.5 rounded-full border border-blue-500/30 shadow-lg backdrop-blur-sm">
                      {/* EDIT HERE: Default status text */}
                      {isFinished ? 'Match Finished' : 'Live Match Updates & Stats'}
                  </span>
              </div>
          </div>
          <div className="absolute top-3 left-3 flex items-center gap-1.5 z-20">
             <span className="bg-red-600/90 backdrop-blur-md text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase tracking-widest flex items-center gap-1">
                <span className="w-1 h-1 bg-white rounded-full animate-pulse shadow-[0_0_5px_white]"></span> FACTSPORT
             </span>
          </div>
      </div>
  );

  const AnnouncementMarquee = () => {
      if (!announcement?.enabled || !announcement.text) return null;
      return (
          <div className="absolute bottom-12 left-0 w-full z-40 overflow-hidden bg-black/60 backdrop-blur-sm pointer-events-auto border-y border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes fs-marquee {
                  0% { transform: translateX(100vw); }
                  100% { transform: translateX(-100%); }
                }
                .animate-fs-marquee {
                  animation: fs-marquee 20s linear infinite;
                }
              `}} />
              <div className="whitespace-nowrap animate-fs-marquee py-2 flex items-center inline-block">
                  {announcement.link ? (
                      <a href={announcement.link} target="_blank" rel="noreferrer" className="text-white font-bold text-xs md:text-sm uppercase hover:text-blue-400 px-4 transition-colors">
                          {announcement.text}
                      </a>
                  ) : (
                      <span className="text-white font-bold text-xs md:text-sm uppercase px-4">{announcement.text}</span>
                  )}
              </div>
          </div>
      );
  };

  if (isTimeLocked) {
      return (
          <div className={`w-full ${mode === 'audio' ? 'h-[120px]' : 'aspect-video'} bg-[#0a1428] relative flex flex-col items-center justify-center overflow-hidden border-b border-slate-800 shadow-inner group`}>
              <div className="absolute inset-0 bg-[url('/tournaments/default-bg.jpg')] bg-cover opacity-20 blur-md grayscale"></div>
              <div className="relative z-10 flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-500">
                  <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10 shadow-lg backdrop-blur-sm">
                     <Clock className="text-slate-400 w-4 h-4 animate-pulse" />
                  </div>
                  <div className="flex flex-col items-center gap-1 px-4">
                      {/* EDIT HERE: Locked state title text */}
                      <span className="text-white font-black uppercase tracking-widest text-[9px] md:text-[10px] text-center drop-shadow-md">
                          {mode === 'audio' ? 'Live Radio Broadcast' : 'Live Match Stream'}
                      </span>
                      <span className="text-blue-400 font-bold uppercase tracking-widest text-[8px] md:text-[9px] bg-blue-900/40 px-3 py-1 rounded-full border border-blue-500/30 shadow-md text-center">
                          {coverageTimeText}
                      </span>
                  </div>
              </div>
          </div>
      );
  }

  if (!mediaUrl) return <DefaultPreview />;
  if (mediaUrl === 'streamio') return <FactSportMediaRoom matchId={matchId} mediaUrl="streamio" />;

  const CustomControls = () => (
     <div className="absolute bottom-0 left-0 w-full bg-[#0a1428] px-4 py-3 z-50 pointer-events-auto border-t border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="text-white hover:text-blue-500 transition shadow-sm bg-white/10 p-1.5 rounded-full backdrop-blur-md">
              {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
            </button>
            <button onClick={toggleMute} className="text-white hover:text-slate-300 transition shadow-sm bg-white/10 p-1.5 rounded-full backdrop-blur-md">
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            {/* EDIT HERE: Player controls brand text */}
            <span className="text-white text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 drop-shadow-md">
                <span className="text-red-500 animate-pulse w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_5px_red]"></span> FACTSPORT {mode === 'audio' ? 'RADIO' : 'PLAYER'}
            </span>
          </div>
          {!(mode === 'audio' || isRawAudio) && (
              <button onClick={handleFullscreen} className="text-white hover:text-blue-500 transition shadow-sm bg-white/10 p-1.5 rounded-full backdrop-blur-md"><Maximize size={16} /></button>
          )}
        </div>
      </div>
  );

  const PlayOverlay = () => (
     <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#0a1428]/80 backdrop-blur-sm">
         <div className="absolute inset-0 bg-[url('/tournaments/default-bg.jpg')] bg-cover opacity-10 blur-sm pointer-events-none"></div>
         
         <button onClick={startPlayback} className="relative z-10 w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.6)] hover:scale-110 transition-transform border border-red-400/50">
             <Play className="text-white w-8 h-8 ml-1" fill="currentColor" />
         </button>
         {/* EDIT HERE: Play button subtitle text */}
         <span className="relative z-10 text-white mt-4 text-[10px] font-black tracking-widest uppercase drop-shadow-md">
             {mode === 'audio' ? 'Listen Live' : 'Watch Live Stream'}
         </span>
     </div>
  );

  const renderYouTube = () => {
    let videoId = '';
    if (mediaUrl.includes('v=')) videoId = mediaUrl.split('v=')[1]?.split('&')[0];
    else if (mediaUrl.includes('.be/')) videoId = mediaUrl.split('.be/')[1];
    else if (mediaUrl.includes('embed/')) videoId = mediaUrl.split('embed/')[1];

    const embedUrl = `https://www.youtube.com/embed/${videoId}?controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&rel=0&showinfo=0&enablejsapi=1&iv_load_policy=3`;

    if (mode === 'audio') {
      return (
        <div ref={playerWrapperRef} className="w-full h-[100px] md:h-[120px] bg-[#0a1428] relative overflow-hidden border-b border-slate-800 shadow-inner group">
            <div className="absolute inset-0 bg-[url('/tournaments/default-bg.jpg')] bg-cover opacity-10 blur-sm pointer-events-none"></div>
            <Radio className="absolute left-6 text-red-500 w-8 h-8 animate-pulse drop-shadow-[0_0_10px_rgba(239,68,68,0.5)] z-10 pointer-events-none" />
            <div className="absolute top-3 left-16 z-10 pointer-events-none">
                <span className="text-white text-[9px] font-black tracking-widest uppercase bg-black/60 px-2 py-0.5 rounded shadow-md border border-white/10 flex items-center gap-1.5">
                    <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></span> Radio Station
                </span>
            </div>
            
            <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 pointer-events-auto">
                <button onClick={togglePlay} className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all">
                    {isPlaying ? <Pause className="text-white" fill="currentColor" /> : <Play className="text-white ml-1" fill="currentColor" />}
                </button>
            </div>

            <div className="opacity-0 pointer-events-none absolute inset-0">
                <iframe ref={iframeRef} src={embedUrl} allow="autoplay; encrypted-media"></iframe>
            </div>
        </div>
      );
    }

    if (!isEmbed && !isFinished && activeMatchId !== matchId && tuneInVideo) {
        return (
            <div className="w-full aspect-video bg-[#0a1428] relative flex flex-col items-center justify-center border-b border-slate-800 animate-in fade-in duration-500">
                <div className="absolute inset-0 bg-[url('/tournaments/default-bg.jpg')] bg-cover opacity-20 blur-sm"></div>
                <button onClick={() => tuneInVideo(matchId, mediaUrl)} className="relative z-10 flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-black tracking-widest uppercase rounded-full shadow-lg transition-all active:scale-95">
                    <Play size={18} fill="currentColor" /> Watch Live TV
                </button>
            </div>
        );
    }

    return (
      <div ref={playerWrapperRef} className="w-full aspect-video bg-black relative overflow-hidden border-b border-slate-800 shadow-inner group flex items-center justify-center">
        <div className="absolute inset-0 z-20 cursor-pointer" onClick={togglePlay}></div>

        <iframe 
            ref={iframeRef} 
            src={embedUrl} 
            className="absolute inset-0 w-full h-full pointer-events-none object-cover z-10" 
            allow="autoplay; encrypted-media; fullscreen" 
            allowFullScreen
        ></iframe>

        {uiBlocker && (
            <div className="absolute inset-0 z-30 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-[70px] bg-[#0a1428]"></div>
                <div className="absolute bottom-0 left-0 w-full h-[60px] bg-[#0a1428]"></div>
            </div>
        )}

        {/* Solid cover when paused to hide YouTube title, channel name and related videos */}
        {hasStarted && !isPlaying && (
            <div className="absolute inset-0 bg-[#0a1428] z-40 flex flex-col items-center justify-center pointer-events-none">
                <button onClick={togglePlay} className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.6)] pointer-events-auto hover:scale-110 transition-transform">
                    <Play className="text-white w-8 h-8 ml-1" fill="currentColor" />
                </button>
                {/* EDIT HERE: Paused state text */}
                <span className="text-white mt-4 text-[10px] font-black tracking-widest uppercase opacity-80">Stream Paused</span>
            </div>
        )}

        <AnnouncementMarquee />
        {!hasStarted && <PlayOverlay />}
        {hasStarted && <CustomControls />}
      </div>
    );
  };

  const renderRawPlayer = () => {
    return (
      <div ref={playerWrapperRef} className={`w-full ${mode === 'audio' || isRawAudio ? 'h-[120px]' : 'aspect-video'} bg-black relative group overflow-hidden border-b border-slate-800 shadow-xl`}>
        {(mode === 'audio' || isRawAudio) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a1428]">
                <div className="absolute inset-0 bg-[url('/tournaments/default-bg.jpg')] bg-cover opacity-20 blur-sm"></div>
                <Radio className="text-red-500 w-12 h-12 animate-pulse drop-shadow-lg mb-2 z-10" />
                <span className="text-white text-xs font-black tracking-widest uppercase z-10 bg-black/50 px-3 py-1 rounded">FactSport Audio</span>
            </div>
        )}

        <div className="absolute inset-0 z-20 cursor-pointer" onClick={togglePlay}></div>

        {mode === 'audio' || isRawAudio ? (
             <audio ref={mediaRef as React.RefObject<HTMLAudioElement>} src={mediaUrl} onTimeUpdate={handleTimeUpdate} onWaiting={() => setIsBuffering(true)} onPlaying={() => setIsBuffering(false)} />
        ) : (
             <video ref={mediaRef as React.RefObject<HTMLVideoElement>} src={mediaUrl} className="w-full h-full object-contain pointer-events-none z-10" onTimeUpdate={handleTimeUpdate} onWaiting={() => setIsBuffering(true)} onPlaying={() => setIsBuffering(false)} />
        )}

        {isBuffering && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"><Loader2 className="text-white animate-spin w-10 h-10 drop-shadow-lg" /></div>}

        <AnnouncementMarquee />
        {!hasStarted && <PlayOverlay />}
        {hasStarted && (
            <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 to-transparent px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50 pointer-events-auto">
              <div className="w-full h-1.5 bg-white/20 rounded-full mb-3 cursor-pointer overflow-hidden backdrop-blur-sm">
                <div className="h-full bg-blue-600 transition-all duration-100" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={togglePlay} className="text-white hover:text-blue-500 transition shadow-sm bg-white/10 p-1.5 rounded-full backdrop-blur-md">
                    {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                  </button>
                  <button onClick={toggleMute} className="text-white hover:text-slate-300 transition shadow-sm bg-white/10 p-1.5 rounded-full backdrop-blur-md">
                    {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <span className="text-white text-[10px] font-bold tracking-widest"><span className="text-red-600 animate-pulse">●</span> FACTSPORT PLAYER</span>
                </div>
                {!(mode === 'audio' || isRawAudio) && (
                    <button onClick={handleFullscreen} className="text-white hover:text-blue-500 transition shadow-sm bg-white/10 p-1.5 rounded-full backdrop-blur-md"><Maximize size={16} /></button>
                )}
              </div>
            </div>
        )}
      </div>
    );
  };

  const renderGenericIframe = () => {
    return (
      <div ref={playerWrapperRef} className={`w-full ${mode === 'audio' ? 'h-[120px]' : 'aspect-video'} bg-[#0a1428] relative border-b border-slate-800 overflow-hidden shadow-xl animate-in fade-in duration-500`}>
         {mode === 'audio' && (
             <div className="absolute inset-0 bg-[url('/tournaments/default-bg.jpg')] bg-cover opacity-20 blur-sm pointer-events-none"></div>
         )}
         
         <iframe src={mediaUrl} className="relative z-10 w-full h-full" frameBorder="0" scrolling="no" sandbox="allow-scripts allow-same-origin" allowFullScreen></iframe>
         
         <AnnouncementMarquee />
         <div className="absolute bottom-0 left-0 w-full h-[30px] bg-[#0a1428] border-t border-slate-800 z-40 flex items-center justify-between px-3 pointer-events-none">
             <div className="flex items-center gap-1.5">
                 <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_red]"></div>
                 <span className="text-[9px] font-black text-white uppercase tracking-widest">{mode === 'audio' ? 'Live Radio' : 'Match Tracker'}</span>
             </div>
             <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                 Powered by <span className="text-white">FactSport</span>
             </div>
         </div>
      </div>
    );
  };

  if (isRawMedia) return renderRawPlayer();
  if (isYouTube) return renderYouTube();
  return renderGenericIframe();
}