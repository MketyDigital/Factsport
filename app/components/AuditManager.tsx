'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Trophy, CheckCircle, XCircle, AlertCircle, Loader2, Play } from 'lucide-react';

export default function AuditManager() {
    const supabase = createClient();
    const [drafts, setDrafts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [runningAudit, setRunningAudit] = useState(false);

    useEffect(() => {
        fetchDrafts();
    }, []);

    const fetchDrafts = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('monthly_winners')
            .select(`*, user:profiles(full_name, email)`)
            .order('month_year', { ascending: false })
            .order('rank', { ascending: true });
        
        if (data) setDrafts(data);
        setLoading(false);
    };

    const handleApprove = async (id: string) => {
        if (!confirm("Approve this winner? They will be permanently logged as the winner.")) return;
        await supabase.from('monthly_winners').update({ is_approved: true }).eq('id', id);
        fetchDrafts();
    };

    const handleDecline = async (id: string) => {
        if (!confirm("Reject and delete this drafted winner?")) return;
        await supabase.from('monthly_winners').delete().eq('id', id);
        fetchDrafts();
    };

    const manuallyRunAudit = async () => {
        if (!confirm("Run the automated audit script now?")) return;
        setRunningAudit(true);
        try {
            const res = await fetch(`/api/admin/run-audit?key=${process.env.NEXT_PUBLIC_CRON_KEY || ''}`);
            const data = await res.json();
            alert(data.message || data.error);
            fetchDrafts();
        } catch (err) {
            alert("Audit failed.");
        }
        setRunningAudit(false);
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="font-bold text-lg flex items-center gap-2">
                    <Trophy size={20} className="text-yellow-500" /> Winner Audit & Verification
                </h2>
                <button 
                    onClick={manuallyRunAudit} 
                    disabled={runningAudit}
                    className="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-black transition flex items-center gap-2"
                >
                    {runningAudit ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} 
                    Force Run Audit
                </button>
            </div>

            <div className="p-0">
                {loading ? (
                    <div className="p-8 text-center text-slate-400 animate-pulse">Loading audits...</div>
                ) : drafts.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">No pending audits.</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {drafts.map((draft) => (
                            <div key={draft.id} className={`p-6 flex flex-col lg:flex-row gap-6 items-start lg:items-center ${draft.is_approved ? 'bg-green-50/30' : 'bg-white'}`}>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] font-black px-2 py-1 rounded-full ${draft.rank === 1 ? 'bg-yellow-100 text-yellow-700' : draft.rank === 2 ? 'bg-slate-100 text-slate-700' : 'bg-orange-100 text-orange-700'}`}>
                                            Rank #{draft.rank}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{draft.month_year}</span>
                                    </div>
                                    <h3 className="text-lg font-black text-slate-800">{draft.user?.full_name || 'Unknown User'}</h3>
                                    <p className="text-xs text-slate-500">{draft.user?.email}</p>
                                    <div className="mt-2 text-sm font-bold text-slate-700">Score: <span className="text-blue-600">{draft.points} Pts</span></div>
                                </div>

                                <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100 w-full lg:w-auto">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2">System Report Card</p>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-bold">
                                        <div className="flex justify-between"><span>VIP+Floor:</span> {draft.audit_report.vip_and_floor ? <span className="text-green-500">✅</span> : <span className="text-red-500">❌</span>}</div>
                                        <div className="flex justify-between"><span>Active Player:</span> {draft.audit_report.active_player ? <span className="text-green-500">✅</span> : <span className="text-red-500">❌</span>}</div>
                                        <div className="flex justify-between"><span>4-Leagues:</span> {draft.audit_report.four_leagues ? <span className="text-green-500">✅</span> : <span className="text-red-500">❌</span>}</div>
                                        <div className="flex justify-between"><span>Perfect Mix:</span> {draft.audit_report.perfect_mix ? <span className="text-green-500">✅</span> : <span className="text-red-500">❌</span>}</div>
                                        <div className="flex justify-between"><span>Score Variety:</span> {draft.audit_report.score_variety ? <span className="text-green-500">✅</span> : <span className="text-red-500">❌</span>}</div>
                                    </div>
                                    {!draft.audit_report.is_passed && (
                                        <div className="mt-2 bg-red-100 text-red-700 text-[9px] font-bold p-1.5 rounded flex items-center gap-1">
                                            <AlertCircle size={10} /> User failed automated audit. Review carefully.
                                        </div>
                                    )}
                                </div>

                                <div className="flex lg:flex-col gap-2 w-full lg:w-48">
                                    {draft.is_approved ? (
                                        <div className="w-full text-center py-2 bg-green-100 text-green-700 font-black text-xs rounded-xl flex items-center justify-center gap-1 border border-green-200">
                                            <CheckCircle size={14} /> PUBLICLY APPROVED
                                        </div>
                                    ) : (
                                        <>
                                            <button onClick={() => handleApprove(draft.id)} className="flex-1 lg:w-full bg-green-500 hover:bg-green-600 text-white font-bold text-xs py-3 rounded-xl transition shadow flex items-center justify-center gap-2">
                                                <CheckCircle size={14} /> Approve Winner
                                            </button>
                                            <button onClick={() => handleDecline(draft.id)} className="flex-1 lg:w-full bg-white hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-200 font-bold text-xs py-3 rounded-xl transition flex items-center justify-center gap-2">
                                                <XCircle size={14} /> Decline
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}