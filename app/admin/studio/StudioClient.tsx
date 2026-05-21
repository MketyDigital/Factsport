'use client';

import { useState } from 'react';
import { Radio, Tv, Mic, Save, Loader2, CheckCircle2, AlertCircle, Power } from 'lucide-react';
import { updateStudioSettings } from './actions'; 

export default function StudioClient({ initialData }: { initialData: any }) {
    // Form State (Notice the router is completely gone!)
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [title, setTitle] = useState(initialData?.title || '');
    const [audioUrl, setAudioUrl] = useState(initialData?.audio_url || '');
    const [videoUrl, setVideoUrl] = useState(initialData?.video_url || '');
    const [isActive, setIsActive] = useState(initialData?.is_active || false);

    // Handle Database Save
    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);

        // 🟢 Passes the data to the secure server environment
        const result = await updateStudioSettings({
            title,
            audioUrl,
            videoUrl,
            isActive
        });

        if (result.error) {
            setMessage({ type: 'error', text: `Failed to save: ${result.error}` });
        } else {
            setMessage({ type: 'success', text: 'Studio broadcast settings updated successfully!' });
            setTimeout(() => setMessage(null), 4000);
        }
        
        setIsSaving(false);
    };

    return (
        <div className="animate-in fade-in zoom-in-95 duration-300">
            
            {message && (
                <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 font-bold text-sm shadow-md animate-in slide-in-from-top-4 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    {message.text}
                </div>
            )}

            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                
                <div className={`p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 transition-colors ${isActive ? 'bg-red-50/50' : 'bg-slate-50/50'}`}>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">Master Power Switch</h2>
                        <p className="text-xs font-semibold text-slate-500 mt-1 max-w-md">Turning this on forces the Global Studio to appear at the top of the /live page.</p>
                    </div>
                    
                    <button 
                        onClick={() => setIsActive(!isActive)}
                        className={`relative w-20 h-10 rounded-full transition-colors duration-300 shadow-inner flex items-center shrink-0 border-2 ${isActive ? 'bg-red-500 border-red-600' : 'bg-slate-300 border-slate-400'}`}
                    >
                        <span className={`absolute w-8 h-8 rounded-full bg-white shadow-md transform transition-transform duration-300 flex items-center justify-center ${isActive ? 'translate-x-10' : 'translate-x-0.5'}`}>
                            <Power size={14} className={isActive ? 'text-red-500' : 'text-slate-400'} />
                        </span>
                    </button>
                </div>

                <div className="p-6 md:p-8 space-y-8">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Broadcast Title</label>
                        <input 
                            type="text" 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Goal Rush Saturday..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                <Mic size={14} className="text-blue-500" /> Audio Route (WebRTC)
                            </label>
                            <input 
                                type="text" 
                                value={audioUrl}
                                onChange={(e) => setAudioUrl(e.target.value)}
                                placeholder="Type 'streamio'"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                            />
                            <p className="text-[10px] font-bold text-slate-400">Leave exactly as <strong className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded">streamio</strong> to use the audio studio.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                <Tv size={14} className="text-red-500" /> Video Route (YouTube)
                            </label>
                            <input 
                                type="text" 
                                value={videoUrl}
                                onChange={(e) => setVideoUrl(e.target.value)}
                                placeholder="Paste YouTube Link here..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                            />
                            <p className="text-[10px] font-bold text-slate-400">Pasting a link here overrides the Audio Route.</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-[#0a1428] hover:bg-blue-700 text-white font-black uppercase tracking-widest text-sm px-8 py-3.5 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-70 flex items-center gap-2"
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        {isSaving ? 'Saving...' : 'Save & Publish'}
                    </button>
                </div>
            </div>
        </div>
    );
}