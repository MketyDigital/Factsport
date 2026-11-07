export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default function AdminStudioPage() {
  return (
    <section className="mx-auto max-w-4xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Media · Broadcast control</p>
      <h1 className="mt-2 text-2xl font-black text-slate-900">Live Studio</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        The V2 broadcast database, dedicated Media administrator identity and Stream token issuer
        have not yet been provisioned. Studio settings, rooms, guest invitations and participant
        permissions are therefore read-only and unavailable. The legacy Supabase studio writer
        has been retired from this branch; no production room or broadcast has been changed.
      </p>
      <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-slate-600">
        <li>Global Goal Rush and match-specific rooms are modeled separately.</li>
        <li>Public listeners do not require Prediction VIP or payment status.</li>
        <li>Host, moderator, caller and invited guest access will use explicit Media room grants.</li>
        <li>Guest invitations will be revocable and room-scoped; token secrets remain in Cloudflare.</li>
      </ul>
    </section>
  );
}
