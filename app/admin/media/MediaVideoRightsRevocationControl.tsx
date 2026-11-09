'use client';

import { useState, useTransition } from 'react';
import { revokeMediaVideoRights } from '../news/media-actions';

export default function MediaVideoRightsRevocationControl({ videoId, onRevoked }: {
  videoId: string; onRevoked: () => void;
}) {
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  return <details className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2">
    <summary className="cursor-pointer text-[10px] font-bold text-rose-800">Withdraw video rights</summary>
    <p className="mt-1 text-[10px] text-rose-800">This blocks public playback and retains the Stream asset and audit history. External posts must be removed separately.</p>
    <textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={2} placeholder="Reason for withdrawal…" className="mt-2 w-full rounded border border-rose-200 bg-white p-2 text-[11px]" />
    <button type="button" disabled={pending || reason.trim().length < 10} onClick={() => startTransition(async () => {
      const result = await revokeMediaVideoRights({ videoId, reason });
      if (!result.success) { setMessage(result.error || 'Unable to withdraw video rights.'); return; }
      setMessage('Video rights withdrawn.');
      onRevoked();
    })} className="mt-2 rounded bg-rose-700 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">{pending ? 'Withdrawing…' : 'Confirm withdrawal'}</button>
    {message && <p role="status" className="mt-1 text-[10px] text-rose-800">{message}</p>}
  </details>;
}
