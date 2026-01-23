export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import { CreditCard, Eye } from 'lucide-react';
import ApproveButton from '@/app/components/ApproveButton';

export default async function AdminDashboard() {
  const supabase = createClient();
  
  // ✅ UPDATED QUERY: Left Join to ensure data shows even if profile is glitchy
  const { data: pendingSubs, error } = await supabase
    .from('subscriptions')
    .select(`
        *,
        user:profiles(full_name, email)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Admin Dashboard Error:", error);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-800">Admin Dashboard</h1>
      
      {/* Error Banner */}
      {error && <div className="p-4 bg-red-100 text-red-700 rounded-xl">Error loading data: {error.message}</div>}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <h2 className="font-bold text-lg flex items-center gap-2"><CreditCard size={20} className="text-blue-600" /> Pending VIP Requests</h2>
            <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-1 rounded-full">{pendingSubs?.length || 0} Waiting</span>
        </div>
        
        {(!pendingSubs || pendingSubs.length === 0) ? (
            <div className="p-10 text-center text-slate-400 text-sm">No pending requests.</div>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                        <tr><th className="p-4">User</th><th className="p-4">Amount</th><th className="p-4">Ref/Hash</th><th className="p-4">Proof</th><th className="p-4 text-right">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {pendingSubs.map((sub: any) => (
                            <tr key={sub.id}>
                                <td className="p-4">
                                    {/* Handle missing user profile gracefully */}
                                    <div className="font-bold">{sub.user?.full_name || 'Unknown User'}</div>
                                    <div className="text-xs text-slate-400">{sub.user?.email || 'No Email'}</div>
                                    <div className="text-[9px] text-slate-300 font-mono">{sub.user_id}</div>
                                </td>
                                <td className="p-4 font-mono font-bold">{sub.payment_method === 'bank' ? `₦${sub.amount}` : `$${sub.amount}`}</td>
                                <td className="p-4"><span className="bg-slate-100 px-2 py-1 rounded font-mono text-xs">{sub.transaction_ref}</span></td>
                                <td className="p-4">
                                    {sub.proof_url ? (
                                        <a href={sub.proof_url} target="_blank" className="text-blue-600 font-bold text-xs flex gap-1 hover:underline">
                                            <Eye size={14}/> View
                                        </a>
                                    ) : (
                                        <span className="text-slate-400 text-xs">None</span>
                                    )}
                                </td>
                                <td className="p-4 text-right"><ApproveButton subId={sub.id} userId={sub.user_id} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </div>
    </div>
  );
}