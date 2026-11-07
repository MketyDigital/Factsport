export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default function MediaMatchOperationsUnavailable() {
  return <section className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-6">
    <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Media system / Match operations</p>
    <h1 className="mt-2 text-2xl font-black">V2 match administration is not provisioned</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">The legacy browser-direct Match Manager mixed provider-owned Media fixture fields with Prediction campaign, affiliate and analysis fields. Its source has been archived. V2 will expose a Media-only match editor with provider-field ownership, reviewed corrections and an audit diff; Prediction campaign and settlement controls will live in the separate Prediction administration surface.</p>
  </section>;
}
