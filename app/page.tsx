// This runs on the Edge (Cloudflare)
export const runtime = 'edge';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-4">
      <div className="bg-red-600 text-white px-6 py-2 rounded-full font-bold uppercase tracking-widest">
        Factsport V2
      </div>
      <h1 className="text-4xl font-black text-slate-900 text-center">
        The War Machine <br />
        <span className="text-red-600">Is Online.</span>
      </h1>
      <p className="text-slate-500 max-w-md text-center">
        System Status: Green. Supabase Connected. Edge Runtime Active.
      </p>
    </div>
  );
}
