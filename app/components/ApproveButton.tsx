'use client';

import { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function ApproveButton({ subId, userId }: { subId: string, userId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleApprove = async () => {
    if (!confirm("Confirm approval? User gets 30 days VIP.")) return;
    setLoading(true);

    // 1. Calculate Expiry (Now + 30 Days)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    // 2. Mark Subscription as Active
    const { error: subError } = await supabase
        .from('subscriptions')
        .update({ status: 'active' })
        .eq('id', subId);

    // 3. Upgrade User Profile with Expiry Date
    const { error: profError } = await supabase
        .from('profiles')
        .update({ 
            is_vip: true,
            vip_expires_at: expiryDate.toISOString()
        })
        .eq('id', userId);

    if (subError || profError) {
        alert("Error updating database");
    } else {
        router.refresh();
    }
    setLoading(false);
  };

  const handleReject = async () => {
    if (!confirm("Reject this request?")) return;
    setLoading(true);
    await supabase.from('subscriptions').update({ status: 'rejected' }).eq('id', subId);
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <button onClick={handleReject} disabled={loading} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50" title="Reject"><X size={16} /></button>
      <button onClick={handleApprove} disabled={loading} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-md">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} /> Approve (30 Days)</>}
      </button>
    </div>
  );
}