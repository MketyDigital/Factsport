'use client';

import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw'; // 🟢 THE FIX: Allows HTML embeds like Twitter/YouTube!
import Link from 'next/link';
import { ExternalLink, Link as LinkIcon } from 'lucide-react';

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      rehypePlugins={[rehypeRaw]} // 🟢 Tells React to safely render the iframe/script tags
      components={{
        // 🟢 1. CUSTOM LINK RENDERER
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

        // 🟢 2. CUSTOM IMAGE RENDERER
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

        // 🟢 3. PARAGRAPH FIX
        p: ({ children, ...props }) => (
          <p className="mb-4 text-slate-700 leading-relaxed" {...props}>
            {children}
          </p>
        ),

        // 🟢 4. IFRAME RE-SIZER (Prevents embeds from breaking your mobile layout)
        iframe: ({ node, ...props }) => (
            <div className="w-full overflow-hidden rounded-xl my-6 flex justify-center bg-slate-50 border border-slate-100">
                <iframe {...props} className="max-w-full" />
            </div>
        )
      }}
    >
      {content}
    </ReactMarkdown>
  );
}