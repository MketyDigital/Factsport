'use client';

import { Share2, Check } from 'lucide-react';
import { useState } from 'react';

export default function ShareButton({ title, slug }: { title: string; slug: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    // Generate the exact live URL
    const url = `https://factsport.com/news/${slug}`;
    
    // Check if the device supports the native share drawer (Mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: `Check out this news on FactSport: ${title}`,
          url: url,
        });
      } catch (error) {
        console.log('Share canceled', error);
      }
    } else {
      // Fallback for Desktop: Copy to clipboard
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button 
        onClick={handleShare}
        className="flex items-center gap-2 text-blue-600 font-bold text-xs hover:bg-blue-50 px-3 py-1.5 rounded-full transition active:scale-95"
    >
        {copied ? <Check size={14} /> : <Share2 size={14} />} 
        {copied ? 'Link Copied!' : 'Share Article'}
    </button>
  );
}