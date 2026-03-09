'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Save, Loader2, Link2, Wallet, HeadphonesIcon, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PromoSettingsManager() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [initialFetchDone, setInitialFetchDone] = useState(false);
    const [formData, setFormData] = useState({
        code_1xbet: '', link_1xbet: '', code_melbet: '', link_melbet: '',
        gateway_link: '', crypto_network: 'USDT/Bitcoin (TRC20)', crypto_address: '', 
        telegram_support: '', default_affiliate_link: '', youtube_link: ''
    });

    useEffect(() => {
        const fetchSettings = async () => {
            const supabase = createClient();
            const { data } = await supabase.from('site_settings').select('*').eq('id', 1).single();
            if (data) {
                setFormData({
                    ...data,
                    crypto_network: data.crypto_network || 'USDT/Bitcoin (TRC20)'
                });
            }
            setInitialFetchDone(true);
        };
        fetchSettings();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        
        try {
            // 🛡️ Safe API Call
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) throw new Error('Failed to save settings');
            
            alert('✅ Settings Updated Successfully!');
            router.refresh(); // Forces Next.js to dump cache
        } catch (error) {
            alert('❌ Error saving settings. Check console.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!initialFetchDone) return <div className="p-10 text-center animate-pulse text-slate-400 font-bold">Loading Settings...</div>;

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mt-6">
            <div className="p-5 border-b border-slate-100 bg-[#0a1428] text-white">
                <h2 className="font-black text-lg flex items-center gap-2 tracking-widest uppercase"><Link2 size={20} className="text-blue-400" /> Global Site Settings</h2>
                <p className="text-[10px] text-slate-400 mt-1">Update promos, payment gateways, and global links.</p>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-8">
                
                {/* GLOBAL LINKS SECTION (NEW) */}
                <div>
                    <h3 className="font-black text-xs text-slate-800 mb-4 uppercase tracking-widest flex items-center gap-2 pb-2 border-b">
                        <Globe size={14} className="text-blue-500"/> Master Links
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3 border p-4 rounded-xl bg-slate-50">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-700">Fallback Affiliate Link</label>
                            <input type="url" placeholder="https://refpa..." className="w-full border rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.default_affiliate_link || ''} onChange={e => setFormData({...formData, default_affiliate_link: e.target.value})} />
                            <p className="text-[9px] text-slate-400 font-medium">Used when a match doesn't have a specific booking code.</p>
                        </div>
                        <div className="space-y-3 border p-4 rounded-xl bg-red-50">
                            <label className="text-[10px] font-black uppercase tracking-widest text-red-700">Official YouTube Channel</label>
                            <input type="url" placeholder="https://youtube.com/..." className="w-full border rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none" value={formData.youtube_link || ''} onChange={e => setFormData({...formData, youtube_link: e.target.value})} />
                        </div>
                    </div>
                </div>

                {/* PROMO SECTION */}
                <div>
                    <h3 className="font-black text-xs text-slate-800 mb-4 uppercase tracking-widest flex items-center gap-2 pb-2 border-b">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span> Betting Promos
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3 border p-4 rounded-xl bg-blue-50/30 border-blue-100 shadow-sm transition-all focus-within:border-blue-500 focus-within:shadow-md">
                            <label className="text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-100 px-2 py-0.5 rounded w-fit">1xBet Integration</label>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500">Promo Code</label>
                                <input type="text" className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-mono font-bold mt-1 focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.code_1xbet || ''} onChange={e => setFormData({...formData, code_1xbet: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 block">Affiliate Link</label>
                                <input type="url" className="w-full border border-slate-200 rounded-lg p-2.5 text-xs mt-1 focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.link_1xbet || ''} onChange={e => setFormData({...formData, link_1xbet: e.target.value})} />
                            </div>
                        </div>
                        
                        <div className="space-y-3 border p-4 rounded-xl bg-yellow-50/30 border-yellow-100 shadow-sm transition-all focus-within:border-yellow-500 focus-within:shadow-md">
                            <label className="text-[10px] font-black uppercase tracking-widest text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded w-fit">Melbet Integration</label>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500">Promo Code</label>
                                <input type="text" className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-mono font-bold mt-1 focus:ring-2 focus:ring-yellow-500 focus:outline-none" value={formData.code_melbet || ''} onChange={e => setFormData({...formData, code_melbet: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 block">Affiliate Link</label>
                                <input type="url" className="w-full border border-slate-200 rounded-lg p-2.5 text-xs mt-1 focus:ring-2 focus:ring-yellow-500 focus:outline-none" value={formData.link_melbet || ''} onChange={e => setFormData({...formData, link_melbet: e.target.value})} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* VIP PAYMENT SECTION */}
                <div>
                    <h3 className="font-black text-xs text-slate-800 mb-4 uppercase tracking-widest flex items-center gap-2 pb-2 border-b">
                        <Wallet size={14} className="text-slate-400"/> VIP Subscription Setup
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3 border p-4 rounded-xl bg-slate-50">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-700">Fiat Gateway (Stripe/Paystack)</label>
                            <input type="url" placeholder="https://pay..." className="w-full border rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-slate-800 focus:outline-none" value={formData.gateway_link || ''} onChange={e => setFormData({...formData, gateway_link: e.target.value})} />
                            <p className="text-[9px] text-slate-400 font-medium">Leave empty to show "Unavailable" on the frontend.</p>
                        </div>
                        
                        <div className="space-y-3 border p-4 rounded-xl bg-slate-50">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-700">Crypto Wallet Details</label>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 block">Wallet Address</label>
                                <input type="text" className="w-full border rounded-lg p-2.5 text-xs font-mono mt-1 focus:ring-2 focus:ring-slate-800 focus:outline-none" value={formData.crypto_address || ''} onChange={e => setFormData({...formData, crypto_address: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 block">Network (e.g. TRC20, ERC20)</label>
                                <input type="text" className="w-full border rounded-lg p-2.5 text-xs mt-1 focus:ring-2 focus:ring-slate-800 focus:outline-none" value={formData.crypto_network || ''} onChange={e => setFormData({...formData, crypto_network: e.target.value})} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* SUPPORT SECTION */}
                <div>
                    <h3 className="font-black text-xs text-slate-800 mb-4 uppercase tracking-widest flex items-center gap-2 pb-2 border-b">
                        <HeadphonesIcon size={14} className="text-slate-400"/> Community & Support
                    </h3>
                    <div className="space-y-3 border p-4 rounded-xl bg-blue-50/20">
                        <label className="text-[10px] font-bold text-slate-500">Official Telegram Group Link</label>
                        <input type="url" placeholder="https://t.me/..." className="w-full border rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.telegram_support || ''} onChange={e => setFormData({...formData, telegram_support: e.target.value})} />
                    </div>
                </div>

                <button type="submit" disabled={loading} className="w-full bg-[#0a1428] text-white font-black uppercase tracking-widest py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-900 transition shadow-xl active:scale-95">
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Push Live Settings
                </button>
            </form>
        </div>
    );
}