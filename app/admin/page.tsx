// ✅ RUNS ON EDGE
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { CreditCard, Eye, ShieldAlert, LayoutDashboard, ArrowRight, Newspaper } from 'lucide-react';
import ApproveButton from '@/app/components/ApproveButton';
import ResetMonthButton from './components/ResetMonthButton'; 
// 👇 IMPORT THE NEW BUTTON HERE
import CleanupButton from './components/CleanupButton'; 

export default async function AdminDashboard() {
  const supabase = createClient();
    
  // 1. Fetch VIP Requests (Pending)
  const { data: pendingSubs, error } = await supabase
    .from('subscriptions')
    .select(`*, user:profiles(full_name, email)`)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) console.error("Admin Dashboard Error:", error);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 p-4 md:p-8 font-sans text-slate-900">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
          <div className="bg-slate-900 p-3 rounded-xl text-white">
              <ShieldAlert size={24} />
          </div>
          <div>
              <h1 className="text-2xl font-black text-slate-900">Admin Control</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Master Dashboard</p>
          </div>
      </div>

      {/* --- SECTION 1: DANGER ZONE (Reset & Cleanup) --- */}
      {/* 👇 I updated this section to be a GRID so the buttons sit side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <ResetMonthButton />
          <CleanupButton /> 
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* --- SECTION 2: VIP REQUESTS (Takes up 2/3 width) --- */}
          <div className="lg:col-span-2 space-y-6">
              {error && <div className="p-4 bg-red-100 text-red-700 rounded-xl text-sm font-bold">Error: {error.message}</div>}

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="font-bold text-lg flex items-center gap-2"><CreditCard size={20} className="text-blue-600" /> Pending VIP Requests</h2>
                    {pendingSubs && pendingSubs.length > 0 && (
                        <span className="bg-red-100 text-red-700 text-[10px] font-black px-2 py-1 rounded-full animate-pulse">
                            {pendingSubs.length} NEW
                        </span>
                    )}
                </div>
                
                {(!pendingSubs || pendingSubs.length === 0) ? (
                    <div className="p-10 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                        <CreditCard size={32} className="opacity-20" />
                        <span>No pending VIP requests.</span>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                                <tr>
                                    <th className="p-4">User</th>
                                    <th className="p-4">Amount</th>
                                    <th className="p-4">Proof</th>
                                    <th className="p-4 text-right">Approve</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pendingSubs.map((sub: any) => (
                                    <tr key={sub.id} className="hover:bg-slate-50 transition">
                                        <td className="p-4">
                                            <div className="font-bold text-slate-800">{sub.user?.full_name || 'Unknown'}</div>
                                            <div className="text-[10px] text-slate-400">{sub.user?.email}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-mono font-bold text-slate-700">{sub.payment_method === 'bank' ? `₦${sub.amount}` : `$${sub.amount}`}</div>
                                            <div className="text-[9px] text-slate-400">{sub.transaction_ref}</div>
                                        </td>
                                        <td className="p-4">
                                            {sub.proof_url ? (
                                                <a href={sub.proof_url} target="_blank" className="text-blue-600 font-bold text-[10px] flex items-center gap-1 hover:underline bg-blue-50 px-2 py-1 rounded w-fit">
                                                    <Eye size={12}/> View
                                                </a>
                                            ) : <span className="text-slate-300 text-[10px] italic">No file</span>}
                                        </td>
                                        <td className="p-4 text-right">
                                            <ApproveButton subId={sub.id} userId={sub.user_id} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
              </div>
          </div>

          {/* --- SECTION 3: QUICK LINKS (Takes up 1/3 width) --- */}
          <div className="space-y-4">
             {/* 1. MATCH MANAGER */}
             <Link href="/admin/matches" className="block group">
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-500 transition relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition group-hover:bg-blue-100"></div>
                     <div className="relative z-10">
                        <div className="bg-blue-600 text-white w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
                            <LayoutDashboard size={24} />
                        </div>
                        <h3 className="font-black text-xl text-slate-800 mb-1">Manage Matches</h3>
                        <p className="text-sm text-slate-500 mb-4">Create games, update scores, and settle predictions.</p>
                        <span className="text-blue-600 font-bold text-sm flex items-center gap-2">
                            Go to Matches <ArrowRight size={16} />
                        </span>
                     </div>
                 </div>
             </Link>

             {/* 2. NEWS MANAGER */}
             <Link href="/admin/news" className="block group">
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-purple-500 transition relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-4 -mt-4 transition group-hover:bg-purple-100"></div>
                     <div className="relative z-10">
                        <div className="bg-purple-600 text-white w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-purple-200">
                            <Newspaper size={24} />
                        </div>
                        <h3 className="font-black text-xl text-slate-800 mb-1">Manage News</h3>
                        <p className="text-sm text-slate-500 mb-4">Post updates, transfer news, and announcements.</p>
                        <span className="text-purple-600 font-bold text-sm flex items-center gap-2">
                            Go to News <ArrowRight size={16} />
                        </span>
                     </div>
                 </div>
             </Link>
          </div>

      </div>
    </div>
  );
}