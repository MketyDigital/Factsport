'use client';
import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Radio, Loader2, Clock, Tv } from 'lucide-react';
import FactSportMediaRoom from './FactSportMediaRoom';
import { useGlobalMedia } from '@/app/providers/GlobalMediaProvider';

export default function FactSportPlayer({ 
  mediaUrl, 
  matchId, 
  mode = 'video', 
  isUpcoming = false, 
  isFinished = false,
  matchDate 
}: { 
  mediaUrl: string, 
  matchId: string, 
  mode?: 'video' | 'audio', 
  isUpcoming?: boolean, 
  isFinished?: boolean,
  matchDate?: string 
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  
  // 🟢 SMART INITIALIZATION: Do the math immediately so the video never "flashes" or leaks
  const [isTimeLocked, setIsTimeLocked] = useState(() => {
      if (isFinished || !matchDate) return false;
      const kickoffTime = new Date(matchDate).getTime();
      const unlockTime = kickoffTime - (5 * 60 * 1000); // 5 mins before
      return Date.now() < unlockTime;
  });

  const [coverageTimeText, setCoverageTimeText] = useState('Available 5 mins to Kick-off');
  
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const { activeMatchId, tuneInVideo, setIsPageActive } = useGlobalMedia();

  const isYouTube = mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be');
  const isRawMedia = mediaUrl.match(/\.(mp4|webm|ogg|mp3|m3u8|wav)$/i);
  const isRawAudio = mediaUrl.match(/\.(mp3|wav)$/i);

  // 🟢 THE BULLETPROOF COUNTDOWN ENGINE
  useEffect(() => {
      if (isFinished || !matchDate) {
          setIsTimeLocked(false);
          return;
      }

      const checkTimeLock = () => {
          const kickoffTime = new Date(matchDate).getTime();
          const now = Date.now();
          const unlockTime = kickoffTime - (5 * 60 * 1000); 

          if (now < unlockTime) {
              setIsTimeLocked(true);
              // Format the exact local time for the user (e.g., "14:30")
              const timeStr = new Date(matchDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              setCoverageTimeText(`Coverage begins at ${timeStr}`);
          } else {
              setIsTimeLocked(false);
          }
      };

      checkTimeLock(); 
      
      // Re-check every 5 seconds to auto-unlock exactly when it's time
      const interval = setInterval(checkTimeLock, 5000);
      return () => clearInterval(interval);
  }, [matchDate, isFinished]);

  useEffect(() => {
      if (activeMatchId === matchId) setIsPageActive(true);
      return () => setIsPageActive(false);
  }, [activeMatchId, matchId, setIsPageActive]);

  const togglePlay = () => {
    if (mediaRef.current) {
      if (isPlaying) mediaRef.current.pause();
      else mediaRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (mediaRef.current) {
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
    const container = document.getElementById('fs-player-wrapper');
    if (container && !document.fullscreenElement) container.requestFullscreen();
    else if (document.fullscreenElement) document.exitFullscreen();
  };

  // 🟢 THE TIME-LOCK SHIELD UI
  // If this returns, absolutely nothing below it (Streamio, YouTube, Audio) can render!
  if (isTimeLocked) {
      return (
          <div className={`w-full ${mode === 'audio' ? 'h-[120px]' : 'aspect-video'} bg-[#0a1428] relative flex flex-col items-center justify-center overflow-hidden border-b border-slate-800 shadow-inner group`}>
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518605368461-1e1e1a8a29a6?q=80')] bg-cover opacity-20 blur-md grayscale"></div>
              <div className="relative z-10 flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-500">
                  <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10 shadow-lg backdrop-blur-sm">
                     <Clock className="text-slate-400 w-4 h-4 animate-pulse" />
                  </div>
                  <div className="flex flex-col items-center gap-1 px-4">
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

  // WEBRTC AUDIO ROOM HANDOFF
  if (mediaUrl === 'streamio') return <FactSportMediaRoom matchId={matchId} mediaUrl="streamio" />;

  // YOUTUBE BLOCK
  const renderYouTube = () => {
    let videoId = '';
    if (mediaUrl.includes('v=')) videoId = mediaUrl.split('v=')[1]?.split('&')[0];
    else if (mediaUrl.includes('.be/')) videoId = mediaUrl.split('.be/')[1];
    else if (mediaUrl.includes('embed/')) videoId = mediaUrl.split('embed/')[1];

    const embedUrl = `https://www.youtube.com/embed/${videoId}`;

    if (mode === 'audio') {
      return (
        <div className="w-full h-[100px] md:h-[120px] bg-[#0a1428] relative overflow-hidden border-b border-slate-800 flex items-center justify-center shadow-inner">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518605368461-1e1e1a8a29a6?q=80')] bg-cover opacity-10 blur-sm pointer-events-none"></div>
            <Radio className="absolute left-6 text-red-500 w-8 h-8 animate-pulse drop-shadow-[0_0_10px_rgba(239,68,68,0.5)] z-10 pointer-events-none" />
            <div className="absolute top-3 left-16 z-10 pointer-events-none">
                <span className="text-white text-[9px] font-black tracking-widest uppercase bg-black/60 px-2 py-0.5 rounded shadow-md border border-white/10 flex items-center gap-1.5">
                    <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></span> Radio Station
                </span>
            </div>
            <div className="relative z-20 w-[80px] h-[60px] overflow-hidden rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.8)] border border-white/20 ml-12 bg-black scale-90 md:scale-100">
                <iframe src={`${embedUrl}?playsinline=1`} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '320px', height: '240px' }} frameBorder="0" allow="autoplay; encrypted-media"></iframe>
            </div>
        </div>
      );
    }

    if (!isFinished && activeMatchId !== matchId) {
        return (
            <div className="w-full aspect-video bg-[#0a1428] relative flex flex-col items-center justify-center border-b border-slate-800 animate-in fade-in duration-500">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518605368461-1e1e1a8a29a6?q=80')] bg-cover opacity-20 blur-sm"></div>
                <button onClick={() => tuneInVideo(matchId, embedUrl)} className="relative z-10 flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-black tracking-widest uppercase rounded-full shadow-lg transition-all active:scale-95">
                    <Play size={18} fill="currentColor" /> Watch Live TV
                </button>
            </div>
        );
    }

    return (
      <div className="w-full aspect-video bg-black relative overflow-hidden border-b border-slate-800 shadow-inner group">
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-[#0a1428] via-[#0a1428]/80 to-transparent z-10 pointer-events-none"></div>
        <div className="absolute top-2 left-2 z-20 pointer-events-none flex items-center gap-1.5">
            <span className={`${isFinished ? 'bg-slate-800' : 'bg-red-600'} text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase tracking-widest flex items-center gap-1`}>
                {!isFinished && <span className="w-1 h-1 bg-white rounded-full animate-pulse"></span>}
                {isFinished ? 'HIGHLIGHTS' : 'LIVE'}
            </span>
            <span className="bg-black/80 backdrop-blur-md text-white text-[8px] font-black px-1.5 py-0.5 rounded border border-white/10 shadow-lg uppercase tracking-widest flex items-center gap-1">
                <Tv size={8} className="text-blue-400"/> FactSport TV
            </span>
        </div>
        <iframe src={`${embedUrl}?autoplay=1&modestbranding=1&rel=0&iv_load_policy=3&controls=1&playsinline=1&fs=1`} className="w-full h-full scale-[1.03]" allowFullScreen></iframe>
      </div>
    );
  };

  const renderRawPlayer = () => {
    return (
      <div id="fs-player-wrapper" className={`w-full ${mode === 'audio' || isRawAudio ? 'h-[120px]' : 'aspect-video'} bg-black relative group overflow-hidden border-b border-slate-800 shadow-xl`}>
        {(mode === 'audio' || isRawAudio) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a1428]">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518605368461-1e1e1a8a29a6?q=80')] bg-cover opacity-20 blur-sm"></div>
                <Radio className="text-red-500 w-12 h-12 animate-pulse drop-shadow-lg mb-2 z-10" />
                <span className="text-white text-xs font-black tracking-widest uppercase z-10 bg-black/50 px-3 py-1 rounded">FactSport Audio</span>
            </div>
        )}

        {mode === 'audio' || isRawAudio ? (
             <audio ref={mediaRef as React.RefObject<HTMLAudioElement>} src={mediaUrl} autoPlay onTimeUpdate={handleTimeUpdate} onWaiting={() => setIsBuffering(true)} onPlaying={() => setIsBuffering(false)} />
        ) : (
             <video ref={mediaRef as React.RefObject<HTMLVideoElement>} src={mediaUrl} className="w-full h-full object-contain" autoPlay onClick={togglePlay} onTimeUpdate={handleTimeUpdate} onWaiting={() => setIsBuffering(true)} onPlaying={() => setIsBuffering(false)} />
        )}

        {isBuffering && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"><Loader2 className="text-white animate-spin w-10 h-10 drop-shadow-lg" /></div>}

        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 to-transparent px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30">
          <div className="w-full h-1.5 bg-white/20 rounded-full mb-3 cursor-pointer overflow-hidden backdrop-blur-sm">
            <div className="h-full bg-blue-600 transition-all duration-100" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={togglePlay} className="text-white hover:text-blue-500 transition">
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              </button>
              <button onClick={toggleMute} className="text-white hover:text-slate-300 transition">
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <span className="text-white text-[10px] font-bold tracking-widest"><span className="text-red-600 animate-pulse">●</span> FACTSPORT PLAYER</span>
            </div>
            {!(mode === 'audio' || isRawAudio) && (
                <button onClick={handleFullscreen} className="text-white hover:text-blue-500 transition"><Maximize size={20} /></button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderGenericIframe = () => {
    return (
      <div className={`w-full ${mode === 'audio' ? 'h-[120px]' : 'aspect-video'} bg-[#0a1428] relative border-b border-slate-800 overflow-hidden shadow-xl animate-in fade-in duration-500`}>
         {mode === 'audio' && (
             <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518605368461-1e1e1a8a29a6?q=80')] bg-cover opacity-20 blur-sm pointer-events-none"></div>
         )}
         
         <iframe src={mediaUrl} className="relative z-10 w-full h-full" frameBorder="0" scrolling="no" sandbox="allow-scripts allow-same-origin" allowFullScreen></iframe>
         
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