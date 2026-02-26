'use client';

import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { ExternalLink, Link as LinkIcon } from 'lucide-react';

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        // 🟢 1. CUSTOM LINK RENDERER (Turns links into beautiful buttons)
        a: ({ href, children, ...props }) => {
          const isInternal = href?.startsWith('/');
          
          // The Tailwind classes that make it look like a button
          const buttonClasses = "inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-lg font-black text-xs uppercase tracking-wider hover:bg-blue-600 hover:text-white transition shadow-sm border border-blue-100 my-1 no-underline group active:scale-95";

          // Internal Links (using Next.js Link)
          if (isInternal) {
            return (
              <Link href={href || '#'} className={buttonClasses} {...props}>
                <LinkIcon size={12} className="group-hover:text-white text-blue-500 transition" />
                {children}
              </Link>
            );
          }

          // External Links (Using <a> with maximum security)
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

        // 🟢 2. CUSTOM IMAGE RENDERER (Makes injected images look premium)
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

        // 🟢 3. PARAGRAPH FIX (Ensures smooth spacing)
        p: ({ children, ...props }) => (
          <p className="mb-4 text-slate-700 leading-relaxed" {...props}>
            {children}
          </p>
        )
      }}
    >
      {content}
    </ReactMarkdown>
  );
}