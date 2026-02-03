'use client';

export default function ScoreAxisWidget({ matchId }: { matchId?: string }) {
  // 1. Safety Check: If no ID, hide completely (don't show white box)
  if (!matchId) return null;

  return (
    <div className="w-full bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm my-4">
      {/* 2. Direct Iframe (React Safe) */}
      <iframe 
        src={`https://www.scoreaxis.com/widget/live-match/${matchId}`}
        style={{ width: '100%', height: '500px', border: 'none' }}
        allowFullScreen
        loading="lazy"
        title="Match Widget"
      />
    </div>
  );
}