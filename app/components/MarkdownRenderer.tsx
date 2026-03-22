'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw'; 
import Link from 'next/link';
import { ExternalLink, Link as LinkIcon, Trophy, Calendar, ChevronRight } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// 🟢 THE EMBEDDED MATCH CARD COMPONENT
function EmbeddedMatchCard({ matchId }: { matchId: string }) {
    const [match, setMatch] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchMatch = async () => {
            const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
            const { data } = await supabase.from('matches').select('*').eq('id', matchId).single();
            if (data) setMatch(data);
            setIsLoading(false);
        };
        fetchMatch();
    }, [matchId]);

    if (isLoading) {
        return <div className="w-full h-[120px] bg-slate-50 rounded-2xl border border-slate-100 animate-pulse my-6"></div>;
    }

    if (!match) return null; 

    const isLive = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET', 'P'].includes(match.status);
    const isFinished = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED'].includes(match.status);

    return (
        <Link href={`/match/${match.id}`} className="block my-8 bg-white border border-slate-200 rounded-3xl p-4 md:p-6 hover:shadow-xl hover:border-blue-300 transition-all duration-300 group no-underline">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Trophy size={12} className="text-yellow-500" /> {match.league}
                </span>
                {isLive ? (
                    <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm uppercase tracking-widest animate-pulse flex items-center gap-1">
                        <span className="w-1 h-1 bg-white rounded-full"></span> LIVE
                    </span>
                ) : (
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <Calendar size={12} /> {new Date(match.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                )}
            </div>

            <div className="flex items-center justify-between">
                <div className="flex flex-col items-center w-[30%]">
                    <img src={match.home_logo || '/placeholder.png'} className="w-10 h-10 md:w-14 md:h-14 object-contain mb-2 drop-shadow-md group-hover:scale-110 transition-transform" alt={match.home_team} />
                    <span className="text-[10px] md:text-xs font-black text-slate-800 text-center leading-tight line-clamp-2">{match.home_team}</span>
                </div>

                <div className="w-[40%] flex flex-col items-center justify-center">
                    {isFinished || isLive ? (
                        <div className="text-3xl md:text-4xl font-black text-slate-800 tracking-tighter drop-shadow-sm">
                            {match.home_score} <span className="text-slate-300 mx-1">-</span> {match.away_score}
                        </div>
                    ) : (
                        <span className="text-xl md:text-2xl font-black text-slate-300 italic">VS</span>
                    )}
                    {isFinished && <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Full Time</span>}
                </div>

                <div className="flex flex-col items-center w-[30%]">
                    <img src={match.away_logo || '/placeholder.png'} className="w-10 h-10 md:w-14 md:h-14 object-contain mb-2 drop-shadow-md group-hover:scale-110 transition-transform" alt={match.away_team} />
                    <span className="text-[10px] md:text-xs font-black text-slate-800 text-center leading-tight line-clamp-2">{match.away_team}</span>
                </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-50 flex justify-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full flex items-center gap-1 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    Match Center <ChevronRight size={12} />
                </span>
            </div>
        </Link>
    );
}

export default function MarkdownRenderer({ content }: { content: string }) {
  // 🟢 1. THE BULLETPROOF PRE-PROCESSOR
  // This finds the shortcode (even if the closing bracket is missing) and replaces it 
  // with an invisible HTML div that we can catch perfectly inside ReactMarkdown.
  const processedContent = content.replace(
      /\[MATCH_WIDGET:([a-zA-Z0-9-]+)\]?/gi, 
      '<div class="match-widget-embed" id="$1"></div>'
  );

  return (
    <ReactMarkdown
      rehypePlugins={[rehypeRaw]} 
      components={{
        
        // 2. INTERCEPT THE CUSTOM DIV TO RENDER THE MATCH CARD
        div: ({ className, id, children, ...props }) => {
            if (className === 'match-widget-embed' && id) {
                return <EmbeddedMatchCard matchId={id} />;
            }
            return <div className={className} id={id} {...props}>{children}</div>;
        },

        // CUSTOM LINK RENDERER
        a: ({ href, children, ...props }) => {
          const isInternal = href?.startsWith('/');
          const buttonClasses = "inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-lg font-black text-xs uppercase tracking-wider hover:bg-blue-600 hover:text-white transition shadow-sm border border-blue-100 my-1 no-underline group active:scale-95";

          if (isInternal) {
            return (
              <Link href={href || '#'} className={buttonClasses} {...props}>
                <LinkIcon size={12} className="group-hover:text-white text-blue-500 transition" />
                {children}
              </Link>
            );
          }

          return (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer" 
              className={buttonClasses}
              {...props}
            >
              {children} 
              <ExternalLink size={12} className="group-hover:text-white text-blue-500 transition" />
            </a>
          );
        },

        // CUSTOM IMAGE RENDERER
        img: ({ src, alt, ...props }) => (
          <span className="block my-6 rounded-2xl overflow-hidden shadow-lg border border-slate-100 bg-slate-50">
            <img 
              src={src} 
              alt={alt || 'Article Image'} 
              className="w-full h-auto object-cover m-0" 
              loading="lazy"
              {...props} 
            />
            {alt && <span className="block text-center text-[10px] font-bold text-slate-400 p-2 bg-slate-50 uppercase tracking-widest">{alt}</span>}
          </span>
        ),

        // STANDARD PARAGRAPHS
        p: ({ children, ...props }) => {
            return (
              <p className="mb-4 text-slate-700 leading-relaxed" {...props}>
                {children}
              </p>
            );
        },

        // IFRAME RE-SIZER
        iframe: ({ node, ...props }) => (
            <div className="w-full overflow-hidden rounded-xl my-6 flex justify-center bg-slate-50 border border-slate-100">
                <iframe {...props} className="max-w-full" />
            </div>
        )
      }}
    >
      {processedContent}
    </ReactMarkdown>
  );
}