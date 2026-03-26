export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
// 🔥 FIX: Added 'Lock' to the import list below!
import { CreditCard, Eye, ShieldAlert, LayoutDashboard, ArrowRight, Newspaper, Settings, Users, Activity, Lock } from 'lucide-react';
import ApproveButton from '@/app/components/ApproveButton';
import ResetMonthButton from './components/ResetMonthButton'; 
import CleanupButton from './components/CleanupButton'; 
import PromoSettingsManager from '@/app/components/PromoSettingsManager';
import GameRulesManager from '@/app/components/GameRulesManager';
import AuditManager from '@/app/components/AuditManager';
// 🟢 NEW: Imported the Social Settings Manager
import SocialSettingsManager from '@/app/components/SocialSettingsManager';

export default async function AdminDashboard() {
  const supabase = createClient();
    
  const { data: pendingSubs, error } = await supabase
    .from('subscriptions')
    .select(`*, user:profiles(full_name, email)`)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) console.error("Admin Dashboard Error:", error);

  return (
    <div className="min-h-screen bg-[#F0F2F5] pb-24 font-sans text-slate-900 selection:bg-blue-200">
      
      {/* ENTERPRISE HEADER */}
      <div className="bg-[#0a1428] pt-8 pb-20 px-6 lg:px-12 relative overflow-hidden shadow-xl border-b border-blue-900/30">
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
         <div className="relative z-10 max-w-7xl mx-auto flex items-center gap-4">
             <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)] border border-blue-400">
                 <ShieldAlert size={28} className="text-white" />
             </div>
             <div>
                 <h1 className="text-3xl font-black text-white tracking-tight">Command Center</h1>
                 <p className="text-[10px] text-blue-300 font-black uppercase tracking-widest mt-1 flex items-center gap-2">
                    <Activity size={12} className="animate-pulse text-green-400"/> System Online
                 </p>
             </div>
         </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-12 -mt-10 relative z-20 space-y-8">
         
         {/* QUICK SYSTEM ACTIONS */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <ResetMonthButton />
             <CleanupButton /> 
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
             
             {/* MAIN LEFT COLUMN */}
             <div className="lg:col-span-8 space-y-8">
                 {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold shadow-sm">Database Error: {error.message}</div>}

                 {/* VIP APPROVALS TRAY */}
                 <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-100 p-2 rounded-lg"><CreditCard size={20} className="text-emerald-600" /></div>
                            <h2 className="font-black text-lg tracking-tight">VIP Authorizations</h2>
                        </div>
                        {pendingSubs && pendingSubs.length > 0 && (
                            <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full animate-pulse shadow-md uppercase tracking-widest border border-red-500">
                                {pendingSubs.length} Pending
                            </span>
                        )}
                    </div>
                    
                    {(!pendingSubs || pendingSubs.length === 0) ? (
                        <div className="p-16 text-center flex flex-col items-center gap-3 bg-slate-50/30">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center shadow-inner">
                                <CreditCard size={28} className="text-slate-300" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-700">All Caught Up</h3>
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">No pending transactions.</span>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[#f8f9fa] text-slate-500 font-black uppercase text-[9px] tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="p-4 pl-6 w-10">Status</th>
                                        <th className="p-4">Customer Details</th>
                                        <th className="p-4">Transaction Info</th>
                                        <th className="p-4 text-center">Receipt</th>
                                        <th className="p-4 pr-6 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {pendingSubs.map((sub: any) => (
                                        <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 pl-6">
                                                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.6)]"></span>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-black text-slate-800 text-sm">{sub.user?.full_name || 'Unknown User'}</div>
                                                <div className="text-[10px] text-slate-500 font-medium">{sub.user?.email}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-mono font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded w-fit text-xs border border-slate-200">
                                                    {sub.payment_method === 'bank' ? `₦${sub.amount}` : `$${sub.amount}`}
                                                </div>
                                                <div className="text-[9px] text-slate-400 font-mono mt-1 uppercase">Ref: {sub.transaction_ref}</div>
                                            </td>
                                            <td className="p-4 text-center">
                                                {sub.proof_url ? (
                                                    <a href={sub.proof_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-black text-[10px] inline-flex items-center gap-1.5 hover:bg-blue-600 hover:text-white transition-colors bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 uppercase tracking-widest">
                                                        <Eye size={12}/> View Proof
                                                    </a>
                                                ) : <span className="bg-slate-100 text-slate-400 text-[9px] font-bold px-2 py-1 rounded-md uppercase tracking-widest border border-slate-200">No Upload</span>}
                                            </td>
                                            <td className="p-4 pr-6 text-right">
                                                <ApproveButton subId={sub.id} userId={sub.user_id} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                 </div>

                 {/* GLOBAL SETTINGS MANAGER */}
                 <PromoSettingsManager />

                 {/* 🟢 NEW: SOCIAL MEDIA COMMAND CENTER */}
                 <SocialSettingsManager />

                 {/* RULES & AUDIT */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <GameRulesManager />
                     <AuditManager />
                 </div>
             </div>

             {/* RIGHT SIDEBAR - QUICK NAV */}
             <div className="lg:col-span-4 space-y-6">
                 
                 <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200 sticky top-24">
                     <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2 pb-2 border-b border-slate-100">
                         <Settings size={14} /> Quick Navigation
                     </h3>
                     
                     <div className="space-y-4">
                         <Link href="/admin/matches" className="block group">
                             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-blue-500 hover:shadow-lg transition-all relative overflow-hidden">
                                 <div className="absolute top-0 right-0 w-20 h-20 bg-blue-100 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                                 <div className="relative z-10 flex items-center gap-4">
                                    <div className="bg-blue-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-md">
                                        <LayoutDashboard size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-sm text-slate-800">Match Engine</h3>
                                        <span className="text-blue-600 font-black text-[9px] uppercase tracking-widest flex items-center gap-1 mt-1">
                                            Manage Data <ArrowRight size={10} />
                                        </span>
                                    </div>
                                 </div>
                             </div>
                         </Link>

                         <Link href="/admin/news" className="block group">
                             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-purple-500 hover:shadow-lg transition-all relative overflow-hidden">
                                 <div className="absolute top-0 right-0 w-20 h-20 bg-purple-100 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                                 <div className="relative z-10 flex items-center gap-4">
                                    <div className="bg-purple-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-md">
                                        <Newspaper size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-sm text-slate-800">News Desk</h3>
                                        <span className="text-purple-600 font-black text-[9px] uppercase tracking-widest flex items-center gap-1 mt-1">
                                            Publish Articles <ArrowRight size={10} />
                                        </span>
                                    </div>
                                 </div>
                             </div>
                         </Link>
                         
                         {/* Placeholder for future User Management */}
                         <div className="block group opacity-50 cursor-not-allowed">
                             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 transition-all relative overflow-hidden">
                                 <div className="relative z-10 flex items-center gap-4">
                                    <div className="bg-slate-400 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-sm">
                                        <Users size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-sm text-slate-800">User Directory</h3>
                                        <span className="text-slate-500 font-black text-[9px] uppercase tracking-widest flex items-center gap-1 mt-1">
                                            Coming Soon <Lock size={10} />
                                        </span>
                                    </div>
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>
             </div>

         </div>
      </div>
    </div>
  );
}