'use client';

import { useEffect, useState } from 'react';

type VariantKey = 'hero_16_9' | 'social_square' | 'thumbnail_4_3' | 'team_square';
type SourceAsset = { id: string; rights_status: string; usage_expires_at: string | null };

const presets: Record<VariantKey, { label: string; width: number; height: number }> = {
  hero_16_9: { label: 'Article hero · 16:9', width: 1600, height: 900 },
  social_square: { label: 'Social image · 1:1', width: 1200, height: 1200 },
  thumbnail_4_3: { label: 'News thumbnail · 4:3', width: 800, height: 600 },
  team_square: { label: 'Team logo · 1:1', width: 512, height: 512 },
};

export default function MediaDerivativeEditor({ asset, onCreated }: {
  asset: SourceAsset; onCreated: () => void;
}) {
  const [variant, setVariant] = useState<VariantKey>('hero_16_9');
  const [focusX, setFocusX] = useState(50);
  const [focusY, setFocusY] = useState(50);
  const [previewUrl, setPreviewUrl] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function createDerivative() {
    setPending(true);
    setMessage('');
    let localPreview = '';
    try {
      const sourceResponse = await fetch('/api/admin/media/' + encodeURIComponent(asset.id), {
        credentials: 'same-origin', cache: 'no-store',
      });
      if (!sourceResponse.ok) throw new Error('The private source image could not be loaded.');
      const sourceBlob = await sourceResponse.blob();
      const bitmap = await createImageBitmap(sourceBlob);
      const preset = presets[variant];
      const targetAspect = preset.width / preset.height;
      const sourceAspect = bitmap.width / bitmap.height;
      let cropWidth = bitmap.width;
      let cropHeight = bitmap.height;
      let cropX = 0;
      let cropY = 0;
      if (sourceAspect > targetAspect) {
        cropWidth = bitmap.height * targetAspect;
        cropX = (bitmap.width - cropWidth) * focusX / 100;
      } else {
        cropHeight = bitmap.width / targetAspect;
        cropY = (bitmap.height - cropHeight) * focusY / 100;
      }

      const canvas = document.createElement('canvas');
      canvas.width = preset.width;
      canvas.height = preset.height;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Image processing is not supported in this browser.');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, cropX, cropY, cropWidth, cropHeight, 0, 0, preset.width, preset.height);
      bitmap.close();
      const derivative = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The browser could not encode the WebP image.')), 'image/webp', 0.88);
      });
      if (derivative.type !== 'image/webp' || derivative.size > 8 * 1024 * 1024) {
        throw new Error('The generated WebP derivative is unsupported or exceeds 8 MB.');
      }

      localPreview = URL.createObjectURL(derivative);
      setPreviewUrl(current => {
        if (current) URL.revokeObjectURL(current);
        return localPreview;
      });

      const form = new FormData();
      form.append('file', new File([derivative], variant + '.webp', { type: 'image/webp' }));
      form.append('sourceAssetId', asset.id);
      form.append('variantKey', variant);
      form.append('focusX', String(focusX));
      form.append('focusY', String(focusY));
      const response = await fetch('/api/admin/media/derivatives', {
        method: 'POST', body: form, credentials: 'same-origin', cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to save the derivative.');
      setMessage('Immutable derivative saved. The original image was not changed; the new asset still needs attachment to an approved article before public delivery.');
      onCreated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Image transformation failed.');
    } finally {
      setPending(false);
    }
  }

  const preset = presets[variant];
  return <div className="mt-3 space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
    <p className="text-xs font-bold text-slate-700">Create immutable crop / resize derivative</p>
    <label className="block text-[11px] font-semibold text-slate-600">Output preset
      <select value={variant} onChange={event => { setVariant(event.target.value as VariantKey); setPreviewUrl(''); }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs">
        {Object.entries(presets).map(([key, value]) => <option key={key} value={key}>{value.label} · {value.width}×{value.height}</option>)}
      </select>
    </label>
    <div className="grid grid-cols-2 gap-3">
      <label className="text-[11px] font-semibold text-slate-600">Horizontal focus · {focusX}%
        <input type="range" min="0" max="100" value={focusX} onChange={event => { setFocusX(Number(event.target.value)); setPreviewUrl(''); }} className="mt-1 w-full" />
      </label>
      <label className="text-[11px] font-semibold text-slate-600">Vertical focus · {focusY}%
        <input type="range" min="0" max="100" value={focusY} onChange={event => { setFocusY(Number(event.target.value)); setPreviewUrl(''); }} className="mt-1 w-full" />
      </label>
    </div>
    <p className="text-[10px] text-slate-500">Output: {preset.width}×{preset.height} WebP · quality 88 · cover crop. Focus controls adjust the crop anchor when the source aspect ratio differs.</p>
    {previewUrl && <img src={previewUrl} alt="Generated crop preview" className="max-h-40 w-full rounded-lg bg-white object-contain" />}
    <button type="button" onClick={() => void createDerivative()} disabled={pending} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
      {pending ? 'Creating derivative…' : 'Generate and save derivative'}
    </button>
    {message && <p role="status" className="text-[11px] text-slate-600">{message}</p>}
  </div>;
}
