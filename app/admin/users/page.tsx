export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default function PredictionUserAdministrationBoundary() {
  return <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6">
    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Prediction system / Identity and entitlements</p>
    <h1 className="mt-2 text-2xl font-black">Prediction user administration is separate</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">The legacy user directory exposed broad profile rows and mixed account administration with VIP entitlement changes. It has been archived and is not available from the Media workspace. V2 account support, Prediction VIP, payments and entitlements require their own least-privilege Prediction roles and audited workflows.</p>
  </section>;
}
