'use client';

import { useState, useTransition } from 'react';
import { revokeMediaRights } from '../news/media-actions';

export default function MediaRightsRevocationControl({ assetId, onRevoked }: {
  assetId: string; onRevoked: () => void;
}) {
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  return <details className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
    <summary className="cursor-pointer text-xs font-bold text-rose-800">Withdraw rights / revoke public use</summary>
    <p className="mt-2 text-[11px] leading-5 text-rose-800">Use when permission is withdrawn, incorrect or no longer valid. The asset and audit history are retained; public article and social projections will stop returning it. Any post already published on an external social network must be removed separately at that provider.</p>
    <label className="mt-2 block text-[11px] font-semibold text-slate-700">Reason
      <textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={3} className="mt-1 w-full rounded-lg border border-rose-200 bg-white p-2 text-xs" placeholder="Record the rights issue and any source reference…" />
    </label>
    <button type="button" disabled={pending || reason.trim().length < 10} onClick={() => startTransition(async () => {
      const result = await revokeMediaRights({ assetId, reason });
      if (!result.success) { setMessage(result.error || 'Rights withdrawal failed.'); return; }
      setMessage('Rights withdrawn. Public projections are now blocked; the original R2 object remains retained for audit.');
      onRevoked();
    })} className="mt-2 rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
      {pending ? 'Withdrawing…' : 'Confirm rights withdrawal'}
    </button>
    {message && <p role="status" className="mt-2 text-[11px] text-rose-800">{message}</p>}
  </details>;
}
