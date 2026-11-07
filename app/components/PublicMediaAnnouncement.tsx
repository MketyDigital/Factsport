'use client';

import { useEffect, useState } from 'react';

type PublicAnnouncement = { announcement_text?: string | null; announcement_link?: string | null; announcement_enabled?: boolean };

export default function PublicMediaAnnouncement() {
  const [announcement, setAnnouncement] = useState<PublicAnnouncement | null>(null);
  useEffect(() => {
    let active = true;
    fetch('/api/settings', { cache: 'force-cache' })
      .then(response => response.ok ? response.json() : null)
      .then((data: PublicAnnouncement | null) => {
        if (active && data?.announcement_enabled === true && typeof data.announcement_text === 'string' && data.announcement_text.trim()) setAnnouncement(data);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  if (!announcement) return null;
  const content = <span className="text-xs font-semibold leading-5">{announcement.announcement_text}</span>;
  return <aside aria-label="FactSport announcement" className="border-b border-blue-100 bg-blue-50 px-4 py-2 text-center text-blue-950">
    {announcement.announcement_link ? <a href={announcement.announcement_link} target="_blank" rel="noopener noreferrer" className="underline decoration-blue-300 underline-offset-2">{content}</a> : content}
  </aside>;
}
